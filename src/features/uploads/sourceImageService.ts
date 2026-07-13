import { sourceImagePath } from '../../lib/storagePaths';
import { supabase } from '../../lib/supabaseClient';
import { ProjectServiceError } from '../projects/api/projectService';
import type { AngleLabel, ProjectSourceImage } from '../projects/types';

const BUCKET = 'source-images-private';
const SIGNED_URL_TTL_SECONDS = 60 * 30;

function requireClient() {
  if (!supabase) {
    throw new ProjectServiceError('not-configured', 'Supabase is not configured.');
  }
  return supabase;
}

async function requireUserId(): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new ProjectServiceError('not-authenticated', 'You are signed out. Sign in again.');
  }
  return data.user.id;
}

function requestFailed(context: string, detail?: string): ProjectServiceError {
  if (import.meta.env.DEV && detail) {
    console.error(`[source-images] ${context}:`, detail);
  }
  return new ProjectServiceError('request-failed', `${context}. Please try again.`);
}

export interface UploadSourceImageInput {
  projectId: string;
  file: File;
  width: number;
  height: number;
  angleLabel: AngleLabel | null;
  sortOrder: number;
}

/**
 * Upload sequence per the brief: validate (done by the caller via
 * imageValidation before we get here) → upload bytes to private storage →
 * insert the metadata row. If the DB insert fails, the just-uploaded
 * object is removed so no orphan remains; if the storage upload fails,
 * nothing is inserted so no false success is recorded. The imageId is
 * generated here — the original filename is never trusted for pathing
 * (sourceImagePath sanitizes it into a suffix only).
 */
export async function uploadSourceImage(
  input: UploadSourceImageInput,
): Promise<ProjectSourceImage> {
  const client = requireClient();
  const userId = await requireUserId();
  const imageId = crypto.randomUUID();
  const path = sourceImagePath({
    userId,
    projectId: input.projectId,
    imageId,
    originalFilename: input.file.name,
  });

  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) {
    throw requestFailed('Uploading the image failed', uploadError.message);
  }

  const { data, error: insertError } = await client
    .from('project_source_images')
    .insert({
      id: imageId,
      project_id: input.projectId,
      owner_id: userId,
      storage_path: path,
      original_filename: input.file.name,
      mime_type: input.file.type,
      file_size_bytes: input.file.size,
      width: input.width,
      height: input.height,
      angle_label: input.angleLabel,
      sort_order: input.sortOrder,
    })
    .select('*')
    .single();

  if (insertError || !data) {
    // Cleanup: don't leave an orphaned object behind the failed record.
    await client.storage.from(BUCKET).remove([path]);
    throw requestFailed('Saving the image record failed', insertError?.message);
  }
  return data as ProjectSourceImage;
}

export async function listSourceImages(projectId: string): Promise<ProjectSourceImage[]> {
  const client = requireClient();
  await requireUserId();
  const { data, error } = await client
    .from('project_source_images')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });
  if (error) throw requestFailed('Loading images failed', error.message);
  return (data ?? []) as ProjectSourceImage[];
}

/** Delete the DB row first (authoritative), then best-effort remove the object. */
export async function deleteSourceImage(image: ProjectSourceImage): Promise<void> {
  const client = requireClient();
  await requireUserId();
  const { error } = await client
    .from('project_source_images')
    .delete()
    .eq('id', image.id);
  if (error) throw requestFailed('Deleting the image failed', error.message);
  const { error: storageError } = await client.storage
    .from(BUCKET)
    .remove([image.storage_path]);
  if (storageError && import.meta.env.DEV) {
    console.error('[source-images] orphaned object after delete:', image.storage_path);
  }
}

export async function updateSourceImageOrder(
  images: { id: string; sort_order: number; angle_label: AngleLabel | null }[],
): Promise<void> {
  const client = requireClient();
  await requireUserId();
  // PostgREST has no bulk update-by-different-values; a handful of images
  // (max 12) makes per-row updates acceptable.
  for (const image of images) {
    const { error } = await client
      .from('project_source_images')
      .update({ sort_order: image.sort_order, angle_label: image.angle_label })
      .eq('id', image.id);
    if (error) throw requestFailed('Saving the image order failed', error.message);
  }
}

/**
 * Short-lived signed URL for an authenticated preview. Never persisted —
 * the DB stores only the storage path; URLs are minted on demand.
 */
export async function createSignedPreviewUrl(storagePath: string): Promise<string> {
  const client = requireClient();
  await requireUserId();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw requestFailed('Creating a preview link failed', error?.message);
  }
  return data.signedUrl;
}
