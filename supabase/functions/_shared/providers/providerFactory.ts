import { createMeshyProvider } from './meshy.ts';
import { createMockProvider } from './mock.ts';
import type { ImageTo3DProvider } from './types.ts';
import { ProviderError } from './types.ts';

/**
 * Resolve the configured provider. Production must use a real provider
 * (e.g. meshy). Mock requires an explicit allow flag.
 */
export function getImageTo3DProvider(): ImageTo3DProvider {
  const name = (Deno.env.get('IMAGE_TO_3D_PROVIDER') ?? '').trim().toLowerCase();

  if (!name) {
    throw new ProviderError(
      'provider-not-configured',
      'IMAGE_TO_3D_PROVIDER is not set. Configure a provider secret before generating models.',
    );
  }

  if (name === 'mock') {
    return createMockProvider();
  }

  if (name === 'meshy') {
    return createMeshyProvider();
  }

  throw new ProviderError(
    'provider-not-configured',
    `Unknown IMAGE_TO_3D_PROVIDER “${name}”. Supported: meshy, mock.`,
  );
}

export function getConfiguredProviderName(): string | null {
  const name = (Deno.env.get('IMAGE_TO_3D_PROVIDER') ?? '').trim().toLowerCase();
  return name || null;
}
