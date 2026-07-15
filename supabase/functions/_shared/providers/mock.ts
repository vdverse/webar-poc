/**
 * Development-only mock provider.
 * Activated only when IMAGE_TO_3D_PROVIDER=mock AND IMAGE_TO_3D_ALLOW_MOCK=true.
 * Never enable ALLOW_MOCK on the production Supabase project without intent.
 *
 * Completes with a stable Khronos sample GLB URL so ingestion can be tested
 * end-to-end without a paid API. This is NOT production generation.
 */

import type {
  CreateGenerationInput,
  ImageTo3DProvider,
  ProviderCreateResult,
  ProviderStatusResult,
} from './types.ts';
import { ProviderError } from './types.ts';

/** Public sample used only by the mock — re-hosted privately on completion. */
export const MOCK_SAMPLE_GLB_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxAnimated/glTF-Binary/BoxAnimated.glb';

const jobs = new Map<
  string,
  { createdAt: number; cancelled: boolean; imageCount: number }
>();

export function assertMockAllowed(): void {
  if (Deno.env.get('IMAGE_TO_3D_PROVIDER') !== 'mock') {
    throw new ProviderError('provider-misconfigured', 'Mock provider is not selected.');
  }
  if (Deno.env.get('IMAGE_TO_3D_ALLOW_MOCK') !== 'true') {
    throw new ProviderError(
      'mock-disabled',
      'Mock provider requires IMAGE_TO_3D_ALLOW_MOCK=true (dev only).',
    );
  }
}

export function createMockProvider(): ImageTo3DProvider {
  assertMockAllowed();

  return {
    name: 'mock',

    async createJob(input: CreateGenerationInput): Promise<ProviderCreateResult> {
      if (!input.imageUrls.length) {
        throw new ProviderError('invalid-images', 'Mock provider requires at least one image URL.');
      }
      const externalJobId = `mock_${crypto.randomUUID()}`;
      jobs.set(externalJobId, {
        createdAt: Date.now(),
        cancelled: false,
        imageCount: input.imageUrls.length,
      });
      return { externalJobId, status: 'submitted' };
    },

    async getJobStatus(externalJobId: string): Promise<ProviderStatusResult> {
      const job = jobs.get(externalJobId);
      if (!job) {
        // Edge cold start may lose in-memory map — synthesise from id prefix.
        if (!externalJobId.startsWith('mock_')) {
          throw new ProviderError('unknown-job', 'Unknown mock job.');
        }
        return {
          status: 'completed',
          progress: 100,
          stage: 'Complete',
          modelUrl: MOCK_SAMPLE_GLB_URL,
          metadata: { mock: true, coldStartRecovery: true },
        };
      }
      if (job.cancelled) {
        return { status: 'cancelled', stage: 'Cancelled' };
      }
      const elapsed = Date.now() - job.createdAt;
      if (elapsed < 1500) {
        return { status: 'processing', progress: 20, stage: 'Waiting in queue' };
      }
      if (elapsed < 3500) {
        return { status: 'processing', progress: 55, stage: 'Building geometry' };
      }
      if (elapsed < 5000) {
        return { status: 'processing', progress: 80, stage: 'Applying textures' };
      }
      return {
        status: 'completed',
        progress: 100,
        stage: 'Complete',
        modelUrl: MOCK_SAMPLE_GLB_URL,
        metadata: { mock: true, imageCount: job.imageCount },
      };
    },

    async cancelJob(externalJobId: string): Promise<void> {
      const job = jobs.get(externalJobId);
      if (job) job.cancelled = true;
    },
  };
}
