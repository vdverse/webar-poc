/** Mirrors the ar_projects table (migrations 0003 + 0012). */

export const PROJECT_MODES = ['markerless_surface', 'image_target'] as const;
export type ProjectMode = (typeof PROJECT_MODES)[number];

export const PROJECT_STATUSES = [
  'draft',
  'uploading',
  'generating',
  'generated',
  'editing',
  'ready',
  'published',
  'generation_failed',
  'archived',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const SOURCE_METHODS = ['single_image', 'multi_view', 'glb_upload'] as const;
export type SourceMethod = (typeof SOURCE_METHODS)[number];

export const WIZARD_STAGES = ['details', 'source_method', 'capture', 'review', 'saved'] as const;
export type WizardStage = (typeof WIZARD_STAGES)[number];

export interface ArProject {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  slug: string;
  mode: ProjectMode;
  status: ProjectStatus;
  source_method: SourceMethod | null;
  wizard_stage: WizardStage | null;
  thumbnail_path: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors the project_source_images table (migration 0004). */
export interface ProjectSourceImage {
  id: string;
  project_id: string;
  owner_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  angle_label: string | null;
  sort_order: number;
  created_at: string;
}

export const ANGLE_LABELS = [
  'front',
  'front-right',
  'right',
  'back-right',
  'back',
  'back-left',
  'left',
  'front-left',
  'top',
  'detail',
] as const;
export type AngleLabel = (typeof ANGLE_LABELS)[number];
