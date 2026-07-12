import './auth.css';

/**
 * Shown instead of crashing whenever an auth or dashboard page is opened
 * without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set — e.g. today's
 * GitHub Pages deployment, which only hosts the static /dev/ar-proof PoC.
 */
export function SupabaseNotConfiguredNotice() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Backend not configured</h1>
        <p>
          This part of the app requires a Supabase project. Set{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{' '}
          (see <code>.env.example</code>) and reload.
        </p>
        <p className="auth-hint">
          The AR proof of concept at <code>/dev/ar-proof</code> does not need this
          and continues to work without it.
        </p>
      </div>
    </div>
  );
}
