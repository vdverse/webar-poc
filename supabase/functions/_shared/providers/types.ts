/**
 * Provider-neutral image-to-3D types for Supabase Edge Functions.
 * Never import this module into the Vite browser bundle.
 */

export type GenerationInputMode = 'single_image' | 'multi_view';

export type GenerationJobStatus =
  | 'queued'
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface CreateGenerationInput {
  projectId: string;
  ownerId: string;
  inputMode: GenerationInputMode;
  /** Short-lived signed HTTPS URLs only — never permanent public paths. */
  imageUrls: string[];
  prompt?: string;
  negativePrompt?: string;
}

export interface ProviderCreateResult {
  externalJobId: string;
  status: GenerationJobStatus;
}

export interface ProviderStatusResult {
  status: GenerationJobStatus;
  progress?: number;
  stage?: string;
  modelUrl?: string;
  previewUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface ImageTo3DProvider {
  name: string;
  createJob(input: CreateGenerationInput): Promise<ProviderCreateResult>;
  getJobStatus(externalJobId: string): Promise<ProviderStatusResult>;
  cancelJob?(externalJobId: string): Promise<void>;
}

export class ProviderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ProviderError';
  }
}
