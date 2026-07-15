/**
 * Canonical public app origin for QR / share URLs.
 * Prefer VITE_PUBLIC_APP_URL; never silently embed a hard-coded localhost
 * origin into production builds.
 */

import { ProjectServiceError } from '../projects/api/projectService';

/** Strip trailing slashes, require http(s), keep origin only (no path). */
export function normalizePublicAppOrigin(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ProjectServiceError('not-configured', 'Public app URL is empty.');
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ProjectServiceError(
      'not-configured',
      'Public app URL is malformed. Use a full URL such as https://webar-poc-one.vercel.app',
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ProjectServiceError(
      'not-configured',
      'Public app URL must use http:// or https://',
    );
  }
  // Drop any path/query/hash — QR origin must be scheme + host[:port] only.
  return `${url.protocol}//${url.host}`;
}

export function resolvePublicAppOrigin(input?: {
  /** Explicit override (tests / rare call sites). */
  originOverride?: string;
  /** From env.VITE_PUBLIC_APP_URL. */
  configured?: string | null;
  /** Browser location.origin fallback (dev only when configured is absent). */
  windowOrigin?: string | null;
  /** Production builds must not fall back to window origin alone. */
  isProd?: boolean;
}): string {
  const configured = (input?.configured ?? '').trim();
  const override = (input?.originOverride ?? '').trim();

  if (override) return normalizePublicAppOrigin(override);
  if (configured) return normalizePublicAppOrigin(configured);

  const isProd = input?.isProd ?? Boolean(import.meta.env.PROD);
  if (isProd) {
    throw new ProjectServiceError(
      'not-configured',
      'VITE_PUBLIC_APP_URL must be set for production so QR codes never use localhost.',
    );
  }

  const win = (input?.windowOrigin ?? '').trim();
  if (win) return normalizePublicAppOrigin(win);

  throw new ProjectServiceError(
    'not-configured',
    'Set VITE_PUBLIC_APP_URL (for LAN mobile testing use your machine HTTPS origin, e.g. https://192.168.1.207:5173).',
  );
}
