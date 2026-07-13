import { z } from 'zod';

/**
 * Typed, validated view of the browser-safe environment. Parsed once at
 * module load; every consumer imports `env` instead of poking at
 * `import.meta.env` directly.
 *
 * All three variables are optional by design: the app must run without any
 * of them (GitHub Pages hosts the static AR PoC with none set) and degrade
 * to explicit "Backend not configured" states rather than crash — that
 * behaviour is enforced by `isSupabaseConfigured` checks and covered by
 * tests. What this module adds is shape validation: if a value IS set but
 * malformed (e.g. VITE_SUPABASE_URL isn't a URL), we fail loudly in dev
 * instead of letting createClient throw somewhere deep in a render.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .url('VITE_SUPABASE_URL must be a full URL, e.g. https://xyz.supabase.co')
    .optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  VITE_PUBLIC_APP_URL: z.string().url().optional(),
});

function readEnv() {
  const raw = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || undefined,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || undefined,
    VITE_PUBLIC_APP_URL: import.meta.env.VITE_PUBLIC_APP_URL || undefined,
  };
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    if (import.meta.env.DEV) {
      throw new Error(`Invalid environment configuration — ${detail}`);
    }
    // In production a malformed value degrades to "not configured" rather
    // than a blank page.
    console.error(`Invalid environment configuration — ${detail}`);
    return { VITE_SUPABASE_URL: undefined, VITE_SUPABASE_ANON_KEY: undefined, VITE_PUBLIC_APP_URL: undefined };
  }
  return parsed.data;
}

export const env = readEnv();

export const isSupabaseConfigured = Boolean(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY,
);
