import { generatedModelPath } from '../../lib/storagePaths';
import { supabase } from '../../lib/supabaseClient';
import { ProjectServiceError } from '../projects/api/projectService';
import type { GlbMetadata } from './glbValidation';
import type { GeneratedModel } from './types';

const BUCKET = 'generated-models-private';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

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
    console.error(`[glb-upload] ${context}:`, detail);
  }
  return new ProjectServiceError('request-failed', `${context}. Please try again.`);
}

function normalizeModel(row: GeneratedModel): GeneratedModel {
  return {
    ...row,
    animation_names: Array.isArray(row.animation_names) ? row.animation_names : [],
    bounds: row.bounds ?? {},
    metadata: row.metadata ?? {},
  };
}

export async function listProjectModels(projectId: string): Promise<GeneratedModel[]> {
  const client = requireClient();
  await requireUserId();
  const { data, error } = await client
    .from('generated_models')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw requestFailed('Loading models failed', error.message);
  return (data as GeneratedModel[]).map(normalizeModel);
}

export async function getLatestModel(projectId: string): Promise<GeneratedModel | null> {
  const models = await listProjectModels(projectId);
  return models[0] ?? null;
}

export async function uploadGlbModel(input: {
  projectId: string;
  file: File;
  meta: GlbMetadata;
}): Promise<GeneratedModel> {
  const client = requireClient();
  const userId = await requireUserId();
  const modelId = crypto.randomUUID();
  const path = generatedModelPath({
    userId,
    projectId: input.projectId,
    modelId,
  });

  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, input.file, {
    contentType: 'model/gltf-binary',
    upsert: false,
  });
  if (uploadError) throw requestFailed('Uploading the GLB failed', uploadError.message);

  const { data, error: insertError } = await client
    .from('generated_models')
    .insert({
      id: modelId,
      project_id: input.projectId,
      owner_id: userId,
      glb_storage_path: path,
      file_size_bytes: input.meta.fileSizeBytes,
      triangle_count: input.meta.triangleCount,
      mesh_count: input.meta.meshCount,
      material_count: input.meta.materialCount,
      texture_count: input.meta.textureCount,
      animation_names: input.meta.animationNames,
      bounds: input.meta.bounds,
      metadata: {
        source: 'direct_glb_upload',
        warnings: input.meta.warnings,
        original_filename: input.file.name,
      },
      processing_status: 'ready',
    })
    .select('*')
    .single();

  if (insertError || !data) {
    await client.storage.from(BUCKET).remove([path]);
    throw requestFailed('Saving model metadata failed', insertError?.message);
  }

  // Reflect upload in project status for the studio flow.
  await client
    .from('ar_projects')
    .update({ status: 'generated', source_method: 'glb_upload', wizard_stage: 'saved' })
    .eq('id', input.projectId);

  return normalizeModel(data as GeneratedModel);
}

export async function createGlbSignedUrl(storagePath: string): Promise<string> {
  const client = requireClient();
  await requireUserId();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw requestFailed('Creating a preview URL failed', error?.message);
  }
  return data.signedUrl;
}
