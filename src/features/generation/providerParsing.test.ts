import { describe, expect, it } from 'vitest';

/**
 * Mirrors Edge Function URL allow-listing / GLB magic for unit tests
 * without importing Deno modules into Vite.
 */

const ALLOWED_RESULT_HOST_SUFFIXES = [
  'meshy.ai',
  'assets.meshy.ai',
  'tripo3d.com',
  'tripo3d.ai',
  'githubusercontent.com',
  'raw.githubusercontent.com',
  'github.com',
];

function isAllowedResultUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
  return ALLOWED_RESULT_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function glbMagicOk(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
}

function mapMeshyStatus(raw: string): string {
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

describe('result URL allow-list', () => {
  it('accepts known provider hosts over https', () => {
    expect(isAllowedResultUrl('https://assets.meshy.ai/foo.glb')).toBe(true);
    expect(
      isAllowedResultUrl(
        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxAnimated/glTF-Binary/BoxAnimated.glb',
      ),
    ).toBe(true);
  });

  it('rejects SSRF-ish targets', () => {
    expect(isAllowedResultUrl('http://assets.meshy.ai/x.glb')).toBe(false);
    expect(isAllowedResultUrl('https://127.0.0.1/x.glb')).toBe(false);
    expect(isAllowedResultUrl('https://169.254.169.254/latest')).toBe(false);
    expect(isAllowedResultUrl('https://evil.example/x.glb')).toBe(false);
  });
});

describe('GLB magic', () => {
  it('requires glTF header', () => {
    expect(glbMagicOk(new TextEncoder().encode('glTF....'))).toBe(true);
    expect(glbMagicOk(new TextEncoder().encode('PNG....'))).toBe(false);
  });
});

describe('Meshy status mapping', () => {
  it('maps provider statuses to internal lifecycle', () => {
    expect(mapMeshyStatus('PENDING')).toBe('queued');
    expect(mapMeshyStatus('SUCCEEDED')).toBe('completed');
    expect(mapMeshyStatus('CANCELED')).toBe('cancelled');
  });
});
