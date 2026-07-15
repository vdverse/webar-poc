/**
 * Meshy image-to-3D provider — contract verified against
 * https://docs.meshy.ai/en/api/image-to-3d and multi-image-to-3d (2026-07-16).
 *
 * Auth: Authorization: Bearer <key>
 * Create single: POST /openapi/v1/image-to-3d  body: { image_url }
 * Create multi:  POST /openapi/v1/multi-image-to-3d  body: { image_urls } (1–4)
 * Status single: GET /openapi/v1/image-to-3d/:id
 * Status multi:  GET /openapi/v1/multi-image-to-3d/:id
 * Statuses: PENDING | IN_PROGRESS | SUCCEEDED | FAILED | CANCELED
 * Result: model_urls.glb on assets.meshy.ai (expiring signed URL)
 * Formats: Meshy accepts jpg/jpeg/png (URL or data URI). WebP is rejected.
 */

import type {
  CreateGenerationInput,
  GenerationInputMode,
  ImageTo3DProvider,
  ProviderCreateResult,
  ProviderStatusResult,
} from './types.ts';
import { ProviderError } from './types.ts';

const MESHY_BASE = 'https://api.meshy.ai/openapi/v1';
/** Meshy multi-image API accepts 1–4 images only (docs). Keep in sync with generationValidation. */
export const MESHY_MULTI_MAX_IMAGES = 4;

function requireApiKey(): string {
  const key = Deno.env.get('IMAGE_TO_3D_API_KEY');
  if (!key) {
    throw new ProviderError(
      'provider-not-configured',
      'IMAGE_TO_3D_API_KEY is not set. Create a Meshy API key and store it as a Supabase secret.',
    );
  }
  return key;
}

export function mapMeshyStatus(raw: string): ProviderStatusResult['status'] {
  switch (raw) {
    case 'PENDING':
      return 'queued';
    case 'IN_PROGRESS':
      return 'processing';
    case 'SUCCEEDED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'CANCELED':
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'processing';
  }
}

export function mapMeshyStage(raw: string | undefined, progress?: number): string {
  switch (raw) {
    case 'PENDING':
      return 'Waiting in queue';
    case 'IN_PROGRESS':
      if (typeof progress === 'number' && progress >= 70) return 'Applying textures';
      if (typeof progress === 'number' && progress >= 40) return 'Building geometry';
      return 'Building geometry';
    case 'SUCCEEDED':
      return 'Complete';
    case 'FAILED':
      return 'Failed';
    case 'CANCELED':
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Processing';
  }
}

function statusPath(inputMode: GenerationInputMode, externalJobId: string): string {
  const base =
    inputMode === 'multi_view'
      ? `${MESHY_BASE}/multi-image-to-3d`
      : `${MESHY_BASE}/image-to-3d`;
  return `${base}/${externalJobId}`;
}

function createPath(inputMode: GenerationInputMode): string {
  return inputMode === 'multi_view'
    ? `${MESHY_BASE}/multi-image-to-3d`
    : `${MESHY_BASE}/image-to-3d`;
}

function httpErrorToCode(status: number): string {
  if (status === 401 || status === 403) return 'invalid-provider-key';
  if (status === 402) return 'provider-quota-exceeded';
  if (status === 429) return 'provider-rate-limit';
  return 'provider-submit-failed';
}

export function createMeshyProvider(): ImageTo3DProvider {
  return {
    name: 'meshy',

    async createJob(input: CreateGenerationInput): Promise<ProviderCreateResult> {
      const key = requireApiKey();

      if (input.inputMode === 'multi_view') {
        if (input.imageUrls.length < 1 || input.imageUrls.length > MESHY_MULTI_MAX_IMAGES) {
          throw new ProviderError(
            'invalid-images',
            `Meshy multi-image mode requires 1–${MESHY_MULTI_MAX_IMAGES} images.`,
          );
        }
      } else if (input.imageUrls.length !== 1) {
        throw new ProviderError('invalid-images', 'Single-image mode requires exactly one image.');
      }

      // Prefer textured GLB only to reduce task time (docs: target_formats).
      const body =
        input.inputMode === 'multi_view'
          ? {
              image_urls: input.imageUrls,
              should_texture: true,
              target_formats: ['glb'],
              ...(input.prompt ? { texture_prompt: input.prompt } : {}),
            }
          : {
              image_url: input.imageUrls[0],
              should_texture: true,
              target_formats: ['glb'],
              ...(input.prompt ? { texture_prompt: input.prompt } : {}),
            };

      const res = await fetch(createPath(input.inputMode), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[meshy] createJob failed', res.status, text.slice(0, 200));
        throw new ProviderError(
          httpErrorToCode(res.status),
          'Could not submit the generation job to Meshy.',
        );
      }

      const data = (await res.json()) as { result?: string };
      if (!data.result) {
        throw new ProviderError('provider-submit-failed', 'Meshy did not return a job id.');
      }
      return { externalJobId: data.result, status: 'submitted' };
    },

    async getJobStatus(
      externalJobId: string,
      opts?: { inputMode?: GenerationInputMode },
    ): Promise<ProviderStatusResult> {
      const key = requireApiKey();
      const inputMode = opts?.inputMode ?? 'single_image';
      const res = await fetch(statusPath(inputMode, externalJobId), {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        // Cold-path recovery: try the other endpoint once if mode was wrong.
        if (res.status === 404 && opts?.inputMode) {
          const alt: GenerationInputMode =
            inputMode === 'multi_view' ? 'single_image' : 'multi_view';
          const altRes = await fetch(statusPath(alt, externalJobId), {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (altRes.ok) {
            return parseStatusPayload(await altRes.json());
          }
        }
        console.error('[meshy] getJobStatus failed', res.status);
        throw new ProviderError('provider-status-failed', 'Could not read Meshy job status.');
      }
      return parseStatusPayload(await res.json());
    },

    async cancelJob(
      externalJobId: string,
      opts?: { inputMode?: GenerationInputMode },
    ): Promise<void> {
      const key = requireApiKey();
      const inputMode = opts?.inputMode ?? 'single_image';
      await fetch(statusPath(inputMode, externalJobId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${key}` },
      });
    },
  };
}

function parseStatusPayload(data: {
  status?: string;
  progress?: number;
  model_urls?: { glb?: string };
  thumbnail_url?: string;
  task_error?: { message?: string };
  id?: string;
  credits?: number;
}): ProviderStatusResult {
  const raw = data.status ?? 'IN_PROGRESS';
  const status = mapMeshyStatus(raw);
  const progress = typeof data.progress === 'number' ? data.progress : undefined;
  return {
    status,
    progress,
    stage: mapMeshyStage(raw, progress),
    modelUrl: data.model_urls?.glb,
    previewUrl: data.thumbnail_url,
    errorMessage: data.task_error?.message,
    metadata: {
      provider: 'meshy',
      meshy_status: raw,
      ...(typeof data.credits === 'number' ? { provider_credits: data.credits } : {}),
    },
  };
}
