import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured } from './env';

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

/**
 * Re-exported so existing imports keep working. True once
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are both set and valid
 * (validated in src/lib/env.ts). Every auth/dashboard page must check this
 * before touching `supabase` — those env vars are unset in this
 * repository's GitHub Pages deployment (which only hosts the static
 * /dev/ar-proof PoC), and `createClient` throws synchronously on an
 * invalid URL rather than failing per-request.
 */
export { isSupabaseConfigured };

export const supabase: SupabaseClient | null =
  isSupabaseConfigured && url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    'Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing). ' +
      'Auth and dashboard routes will show a "not configured" state. See .env.example.',
  );
}
