import { env } from '../../lib/env';
import { isValidSlug, publishedAssetPath, slugify } from '../../lib/storagePaths';
import { supabase } from '../../lib/supabaseClient';
import { ProjectServiceError } from '../projects/api/projectService';
import type { ArProject } from '../projects/types';
import type { GeneratedModel, Publication, PublicationSnapshot, SceneSettings } from './types';

const PRIVATE_BUCKET = 'generated-models-private';
const PUBLIC_BUCKET = 'published-ar-assets';

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
    console.error(`[publish] ${context}:`, detail);
  }
  return new ProjectServiceError('request-failed', `${context}. Please try again.`);
}

export function publicObjectUrl(storagePath: string): string {
  const base = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) throw new ProjectServiceError('not-configured', 'Supabase is not configured.');
  return `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${storagePath}`;
}

/** Absolute URL for the public viewer page (what the QR encodes). */
export function buildPublicViewerUrl(publicSlug: string, originOverride?: string): string {
  const origin = (originOverride || env.VITE_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${origin}${basename}/view/${publicSlug}`;
}

export function assertCanPublish(input: {
  project: ArProject;
  model: GeneratedModel | null;
  settings: SceneSettings | null;
}): void {
  if (!input.project?.name?.trim()) {
    throw new ProjectServiceError('request-failed', 'Project needs a name before publishing.');
  }
  if (!input.model || input.model.processing_status !== 'ready' || !input.model.glb_storage_path) {
    throw new ProjectServiceError('request-failed', 'Upload a valid GLB before publishing.');
  }
  if (!input.settings) {
    throw new ProjectServiceError('request-failed', 'Save scene settings before publishing.');
  }
  if (!(input.settings.scale > 0)) {
    throw new ProjectServiceError('request-failed', 'Scale must be greater than zero.');
  }
}

export function makePublicSlug(projectName: string, projectId: string): string {
  const base = slugify(projectName).slice(0, 40);
  const suffix = projectId.replace(/-/g, '').slice(0, 8);
  const slug = `${base}-${suffix}`;
  if (!isValidSlug(slug)) {
    return `ar-${suffix}`;
  }
  return slug;
}

function buildSnapshot(input: {
  project: ArProject;
  settings: SceneSettings;
  glbPublicPath: string;
  glbPublicUrl: string;
  usdzPublicUrl: string | null;
}): PublicationSnapshot {
  const cfg = input.settings.viewer_config ?? {};
  return {
    title: input.project.name,
    description: input.project.description,
    glbPublicPath: input.glbPublicPath,
    glbPublicUrl: input.glbPublicUrl,
    usdzPublicUrl: input.usdzPublicUrl,
    posterPublicUrl: null,
    scene: {
      scale: Number(input.settings.scale),
      rotationX: Number(input.settings.rotation_x),
      rotationY: Number(input.settings.rotation_y),
      rotationZ: Number(input.settings.rotation_z),
      placementMode: input.settings.placement_mode,
      shadowIntensity: Number(input.settings.shadow_intensity),
      autoRotate: Boolean(input.settings.auto_rotate),
      cameraControls: Boolean(input.settings.camera_controls),
      animationName: input.settings.animation_name,
      animationAutoplay: Boolean(input.settings.animation_autoplay),
      animationLoop: Boolean(input.settings.animation_loop),
      physicalWidth: typeof cfg.physicalWidth === 'number' ? cfg.physicalWidth : null,
      physicalHeight: typeof cfg.physicalHeight === 'number' ? cfg.physicalHeight : null,
      physicalDepth: typeof cfg.physicalDepth === 'number' ? cfg.physicalDepth : null,
    },
    // iPhone Quick Look only when a USDZ URL is present; otherwise webxr + scene-viewer.
    arModes: input.usdzPublicUrl ? 'webxr scene-viewer quick-look' : 'webxr scene-viewer',
    publishedAt: new Date().toISOString(),
  };
}

export async function getActivePublicationForProject(projectId: string): Promise<Publication | null> {
  const client = requireClient();
  await requireUserId();
  const { data, error } = await client
    .from('publications')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw requestFailed('Loading publication failed', error.message);
  return (data as Publication | null) ?? null;
}

/** Public (anon-safe) lookup used by /view/:publicSlug. */
export async function getActivePublicationBySlug(publicSlug: string): Promise<Publication | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('publications')
    .select('*')
    .eq('public_slug', publicSlug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw requestFailed('Loading the public experience failed', error.message);
  return (data as Publication | null) ?? null;
}

/**
 * Publish: copy GLB to the public bucket, deactivate prior versions, insert
 * an immutable snapshot. QR codes must encode buildPublicViewerUrl(slug) —
 * never a private signed URL.
 */
export async function publishProject(input: {
  project: ArProject;
  model: GeneratedModel;
  settings: SceneSettings;
}): Promise<{ publication: Publication; viewerUrl: string }> {
  assertCanPublish(input);

  const client = requireClient();
  const userId = await requireUserId();

  const { data: priorRows, error: priorError } = await client
    .from('publications')
    .select('version')
    .eq('project_id', input.project.id)
    .order('version', { ascending: false })
    .limit(1);
  if (priorError) throw requestFailed('Checking publication history failed', priorError.message);

  const nextVersion = (priorRows?.[0]?.version ?? 0) + 1;
  const publicSlug =
    (await getActivePublicationForProject(input.project.id))?.public_slug ??
    makePublicSlug(input.project.name, input.project.id);

  const glbPublicPath = publishedAssetPath({
    projectId: input.project.id,
    publicationVersion: nextVersion,
    file: 'model.glb',
  });

  const { data: blob, error: downloadError } = await client.storage
    .from(PRIVATE_BUCKET)
    .download(input.model.glb_storage_path);
  if (downloadError || !blob) {
    throw requestFailed('Reading the private GLB failed', downloadError?.message);
  }

  const { error: uploadError } = await client.storage.from(PUBLIC_BUCKET).upload(glbPublicPath, blob, {
    contentType: 'model/gltf-binary',
    upsert: true,
  });
  if (uploadError) throw requestFailed('Publishing the GLB failed', uploadError.message);

  let usdzPublicUrl: string | null = null;
  if (input.model.usdz_storage_path) {
    const usdzPath = publishedAssetPath({
      projectId: input.project.id,
      publicationVersion: nextVersion,
      file: 'model.usdz',
    });
    const { data: usdzBlob, error: usdzDl } = await client.storage
      .from(PRIVATE_BUCKET)
      .download(input.model.usdz_storage_path);
    if (!usdzDl && usdzBlob) {
      const { error: usdzUp } = await client.storage.from(PUBLIC_BUCKET).upload(usdzPath, usdzBlob, {
        contentType: 'model/vnd.usdz+zip',
        upsert: true,
      });
      if (!usdzUp) usdzPublicUrl = publicObjectUrl(usdzPath);
    }
  }

  const glbPublicUrl = publicObjectUrl(glbPublicPath);
  const snapshot = buildSnapshot({
    project: input.project,
    settings: input.settings,
    glbPublicPath,
    glbPublicUrl,
    usdzPublicUrl,
  });

  // Deactivate previous active row(s) then insert the new version.
  const { error: deactivateError } = await client
    .from('publications')
    .update({ is_active: false })
    .eq('project_id', input.project.id)
    .eq('is_active', true);
  if (deactivateError) throw requestFailed('Updating prior publications failed', deactivateError.message);

  const { data: publication, error: insertError } = await client
    .from('publications')
    .insert({
      project_id: input.project.id,
      owner_id: userId,
      public_slug: publicSlug,
      version: nextVersion,
      snapshot,
      is_active: true,
    })
    .select('*')
    .single();

  if (insertError || !publication) {
    throw requestFailed('Creating the publication failed', insertError?.message);
  }

  await client
    .from('ar_projects')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', input.project.id);

  const viewerUrl = buildPublicViewerUrl(publicSlug);
  return { publication: publication as Publication, viewerUrl };
}
