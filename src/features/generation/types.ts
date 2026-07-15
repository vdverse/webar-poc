/** Browser-safe generation types (no provider secrets). */

export type GenerationInputMode = 'single_image' | 'multi_view';

export type GenerationJobStatus =
  | 'queued'
  | 'uploading'
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface GenerationJob {
  id: string;
  project_id: string;
  status: GenerationJobStatus;
  stage: string | null;
  progress: number;
  provider: string;
  input_mode: GenerationInputMode;
  safe_error_code: string | null;
  safe_error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export const HONEST_STAGES = [
  'Preparing images',
  'Submitting generation',
  'Waiting in queue',
  'Building geometry',
  'Applying textures',
  'Optimising model',
  'Downloading result',
  'Validating GLB',
  'Preparing studio',
  'Complete',
] as const;

export function isActiveGenerationStatus(status: GenerationJobStatus): boolean {
  return status === 'queued' || status === 'uploading' || status === 'submitted' || status === 'processing';
}

export function canShowNumericProgress(progress: number | null | undefined): boolean {
  return typeof progress === 'number' && progress > 0 && progress < 100;
}
