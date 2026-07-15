/** Generation request validation helpers (Edge Function side). */

export const SINGLE_IMAGE_COUNT = 1;
export const MULTI_VIEW_MIN = 2;
export const MULTI_VIEW_MAX = 12;
/** Fallback soft cap when profiles.generation_credits is unavailable. */
export const DEV_GENERATION_LIMIT = 10;
export const SIGNED_URL_TTL_SECONDS = 15 * 60;
export const MAX_RESULT_BYTES = 25 * 1024 * 1024;

/** Domains allowed when downloading provider result GLBs (SSRF guard). */
export const ALLOWED_RESULT_HOST_SUFFIXES = [
  'meshy.ai',
  'assets.meshy.ai',
  'tripo3d.com',
  'tripo3d.ai',
  'githubusercontent.com',
  'raw.githubusercontent.com',
  'github.com',
];

export function isAllowedResultUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return false;
  }
  // Block obvious private IP literals
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
  return ALLOWED_RESULT_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export function glbMagicOk(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === 0x67 && // g
    bytes[1] === 0x6c && // l
    bytes[2] === 0x54 && // T
    bytes[3] === 0x46 // F
  );
}

export function buildRequestHash(parts: {
  projectId: string;
  inputMode: string;
  imageIds: string[];
}): string {
  const payload = `${parts.projectId}|${parts.inputMode}|${[...parts.imageIds].sort().join(',')}`;
  // Edge Functions support SubtleCrypto
  return payload; // hashed in async helper
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function validateImageCounts(
  inputMode: 'single_image' | 'multi_view',
  count: number,
): string | null {
  if (inputMode === 'single_image' && count !== SINGLE_IMAGE_COUNT) {
    return 'missing-images';
  }
  if (inputMode === 'multi_view' && (count < MULTI_VIEW_MIN || count > MULTI_VIEW_MAX)) {
    return 'missing-images';
  }
  return null;
}
