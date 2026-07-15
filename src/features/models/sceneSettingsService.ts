import { supabase } from '../../lib/supabaseClient';
import { ProjectServiceError } from '../projects/api/projectService';
import type { ArScaleMode, PlacementMode, SceneSettings } from './types';

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
    console.error(`[scene-settings] ${context}:`, detail);
  }
  return new ProjectServiceError('request-failed', `${context}. Please try again.`);
}

export interface SceneSettingsInput {
  projectId: string;
  modelId?: string | null;
  scale: number;
  rotation_x: number;
  rotation_y: number;
  rotation_z: number;
  placement_mode: PlacementMode;
  shadow_intensity: number;
  auto_rotate: boolean;
  camera_controls: boolean;
  animation_name: string | null;
  animation_autoplay: boolean;
  animation_loop: boolean;
  physicalWidth?: number | null;
  physicalHeight?: number | null;
  physicalDepth?: number | null;
  arScaleMode?: ArScaleMode;
}

export function defaultSceneSettings(
  projectId: string,
  ownerId: string,
  modelId: string | null = null,
): SceneSettings {
  return {
    project_id: projectId,
    owner_id: ownerId,
    model_id: modelId,
    scale: 1,
    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,
    placement_mode: 'floor',
    shadow_intensity: 1,
    auto_rotate: true,
    camera_controls: true,
    animation_name: null,
    animation_autoplay: true,
    animation_loop: true,
    viewer_config: { arScaleMode: 'fixed' },
    updated_at: new Date().toISOString(),
  };
}

export async function getSceneSettings(projectId: string): Promise<SceneSettings | null> {
  const client = requireClient();
  await requireUserId();
  const { data, error } = await client
    .from('scene_settings')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw requestFailed('Loading scene settings failed', error.message);
  return (data as SceneSettings | null) ?? null;
}

export async function upsertSceneSettings(input: SceneSettingsInput): Promise<SceneSettings> {
  const client = requireClient();
  const userId = await requireUserId();

  for (const [label, raw] of [
    ['physical width', input.physicalWidth],
    ['physical height', input.physicalHeight],
    ['physical depth', input.physicalDepth],
  ] as const) {
    if (raw != null && !Number.isFinite(raw)) {
      throw requestFailed(`Invalid ${label}`);
    }
  }

  const viewer_config = {
    physicalWidth: input.physicalWidth ?? undefined,
    physicalHeight: input.physicalHeight ?? undefined,
    physicalDepth: input.physicalDepth ?? undefined,
    arScaleMode: input.arScaleMode === 'auto' ? 'auto' : 'fixed',
  };

  const row = {
    project_id: input.projectId,
    owner_id: userId,
    model_id: input.modelId ?? null,
    scale: input.scale,
    rotation_x: input.rotation_x,
    rotation_y: input.rotation_y,
    rotation_z: input.rotation_z,
    placement_mode: input.placement_mode,
    shadow_intensity: input.shadow_intensity,
    auto_rotate: input.auto_rotate,
    camera_controls: input.camera_controls,
    animation_name: input.animation_name,
    animation_autoplay: input.animation_autoplay,
    animation_loop: input.animation_loop,
    viewer_config,
  };

  const { data, error } = await client
    .from('scene_settings')
    .upsert(row, { onConflict: 'project_id' })
    .select('*')
    .single();

  if (error || !data) throw requestFailed('Saving scene settings failed', error?.message);
  return data as SceneSettings;
}
