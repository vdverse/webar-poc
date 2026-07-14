/** Mirrors generated_models / scene_settings / publications for the GLB slice. */

import type { GlbBounds } from './glbValidation';

export interface GeneratedModel {
  id: string;
  project_id: string;
  generation_job_id: string | null;
  owner_id: string;
  glb_storage_path: string;
  usdz_storage_path: string | null;
  thumbnail_storage_path: string | null;
  original_provider_url: string | null;
  file_size_bytes: number | null;
  triangle_count: number | null;
  mesh_count: number | null;
  material_count: number | null;
  texture_count: number | null;
  animation_names: string[];
  bounds: GlbBounds | Record<string, unknown>;
  metadata: Record<string, unknown>;
  processing_status: 'ready' | 'validating' | 'invalid';
  created_at: string;
  updated_at: string;
}

export const PLACEMENT_MODES = ['floor', 'wall', 'table'] as const;
export type PlacementMode = (typeof PLACEMENT_MODES)[number];

export interface SceneSettings {
  project_id: string;
  owner_id: string;
  model_id: string | null;
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
  viewer_config: {
    physicalWidth?: number;
    physicalHeight?: number;
    physicalDepth?: number;
    [key: string]: unknown;
  };
  updated_at: string;
}

export interface PublicationSnapshot {
  title: string;
  description: string | null;
  glbPublicPath: string;
  glbPublicUrl: string;
  usdzPublicUrl: string | null;
  posterPublicUrl: string | null;
  scene: {
    scale: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
    placementMode: PlacementMode;
    shadowIntensity: number;
    autoRotate: boolean;
    cameraControls: boolean;
    animationName: string | null;
    animationAutoplay: boolean;
    animationLoop: boolean;
    physicalWidth: number | null;
    physicalHeight: number | null;
    physicalDepth: number | null;
  };
  arModes: string;
  publishedAt: string;
}

export interface Publication {
  id: string;
  project_id: string;
  owner_id: string;
  public_slug: string;
  version: number;
  snapshot: PublicationSnapshot;
  is_active: boolean;
  created_at: string;
}
