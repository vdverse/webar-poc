/**
 * Meshy adapter scaffold for Batch 3B.
 * Confirmed contract (docs.meshy.ai): Bearer auth, image-to-3d + multi-image-to-3d,
 * poll GET, model_urls.glb. Full implementation lands when IMAGE_TO_3D_API_KEY is set.
 */

import type {
  CreateGenerationInput,
  ImageTo3DProvider,
  ProviderCreateResult,
  ProviderStatusResult,
} from './types.ts';
import { ProviderError } from './types.ts';

const MESHY_BASE = 'https://api.meshy.ai/openapi/v1';

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

function mapStatus(raw: string): ProviderStatusResult['status'] {
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

export function createMeshyProvider(): ImageTo3DProvider {
  return {
    name: 'meshy',

    async createJob(input: CreateGenerationInput): Promise<ProviderCreateResult> {
      const key = requireApiKey();
      const endpoint =
        input.inputMode === 'multi_view'
          ? `${MESHY_BASE}/multi-image-to-3d`
          : `${MESHY_BASE}/image-to-3d`;

      const body =
        input.inputMode === 'multi_view'
          ? {
              image_urls: input.imageUrls,
              ...(input.prompt ? { prompt: input.prompt } : {}),
            }
          : {
              image_url: input.imageUrls[0],
              ...(input.prompt ? { prompt: input.prompt } : {}),
            };

      const res = await fetch(endpoint, {
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
          res.status === 401 || res.status === 403
            ? 'invalid-provider-key'
            : res.status === 429
              ? 'provider-rate-limit'
              : 'provider-submit-failed',
          'Could not submit the generation job to Meshy.',
        );
      }

      const data = (await res.json()) as { result?: string };
      if (!data.result) {
        throw new ProviderError('provider-submit-failed', 'Meshy did not return a job id.');
      }
      return { externalJobId: data.result, status: 'submitted' };
    },

    async getJobStatus(externalJobId: string): Promise<ProviderStatusResult> {
      const key = requireApiKey();
      const res = await fetch(`${MESHY_BASE}/image-to-3d/${externalJobId}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        throw new ProviderError('provider-status-failed', 'Could not read Meshy job status.');
      }
      const data = (await res.json()) as {
        status?: string;
        progress?: number;
        model_urls?: { glb?: string };
        task_error?: { message?: string };
      };
      const status = mapStatus(data.status ?? 'IN_PROGRESS');
      return {
        status,
        progress: typeof data.progress === 'number' ? data.progress : undefined,
        stage: data.status,
        modelUrl: data.model_urls?.glb,
        errorMessage: data.task_error?.message,
        metadata: { provider: 'meshy' },
      };
    },
  };
}
