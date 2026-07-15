import { describe, expect, it } from 'vitest';

import { ProjectServiceError } from '../projects/api/projectService';
import { normalizePublicAppOrigin, resolvePublicAppOrigin } from './publicAppOrigin';

describe('normalizePublicAppOrigin', () => {
  it('accepts Vercel origin and strips trailing slash', () => {
    expect(normalizePublicAppOrigin('https://webar-poc-one.vercel.app/')).toBe(
      'https://webar-poc-one.vercel.app',
    );
  });

  it('accepts localhost', () => {
    expect(normalizePublicAppOrigin('http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('accepts LAN HTTPS address', () => {
    expect(normalizePublicAppOrigin('https://192.168.1.207:5173/')).toBe(
      'https://192.168.1.207:5173',
    );
  });

  it('rejects malformed URL', () => {
    expect(() => normalizePublicAppOrigin('not-a-url')).toThrow(ProjectServiceError);
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => normalizePublicAppOrigin('ftp://example.com')).toThrow(/http/i);
  });
});

describe('resolvePublicAppOrigin', () => {
  it('prefers configured origin over window', () => {
    expect(
      resolvePublicAppOrigin({
        configured: 'https://webar-poc-one.vercel.app',
        windowOrigin: 'http://localhost:5173',
        isProd: false,
      }),
    ).toBe('https://webar-poc-one.vercel.app');
  });

  it('uses window origin in dev when configured is absent', () => {
    expect(
      resolvePublicAppOrigin({
        configured: undefined,
        windowOrigin: 'https://192.168.1.207:5173',
        isProd: false,
      }),
    ).toBe('https://192.168.1.207:5173');
  });

  it('fails clearly in production without configured origin', () => {
    expect(() =>
      resolvePublicAppOrigin({
        configured: undefined,
        windowOrigin: 'http://localhost:5173',
        isProd: true,
      }),
    ).toThrow(/VITE_PUBLIC_APP_URL must be set/i);
  });

  it('honours explicit override', () => {
    expect(
      resolvePublicAppOrigin({
        originOverride: 'https://webar-poc-one.vercel.app/',
        configured: 'http://localhost:5173',
        isProd: true,
      }),
    ).toBe('https://webar-poc-one.vercel.app');
  });
});
