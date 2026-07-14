import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { AuthContext, type AuthContextValue } from './AuthContext';
import type { Session } from '@supabase/supabase-js';

/** Turns a Supabase/auth error into copy safe to show a user — no raw stack traces or internal detail. */
function friendlyAuthError(message: string): string {
  const known: Record<string, string> = {
    'Invalid login credentials': 'Incorrect email or password.',
    'User already registered': 'An account with this email already exists.',
    'Email not confirmed': 'Please confirm your email before signing in.',
  };
  return known[message] ?? 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isConfigured: isSupabaseConfigured,
      async signInWithPassword(email, password) {
        if (!supabase) return { error: 'Supabase is not configured.' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? friendlyAuthError(error.message) : null };
      },
      async signUpWithPassword(email, password) {
        if (!supabase) return { error: 'Supabase is not configured.' };
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error ? friendlyAuthError(error.message) : null };
      },
      async signInWithGoogle() {
        if (!supabase) return { error: 'Supabase is not configured.' };
        // Requires the Google provider to be configured in the Supabase
        // project dashboard; if it isn't, Supabase returns a descriptive
        // error which friendlyAuthError falls back to generic copy for.
        const base = import.meta.env.BASE_URL.replace(/\/$/, '');
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}${base}/dashboard`,
          },
        });
        return { error: error ? friendlyAuthError(error.message) : null };
      },
      async requestPasswordReset(email) {
        if (!supabase) return { error: 'Supabase is not configured.' };
        const base = import.meta.env.BASE_URL.replace(/\/$/, '');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${base}/reset-password`,
        });
        return { error: error ? friendlyAuthError(error.message) : null };
      },
      async updatePassword(newPassword) {
        if (!supabase) return { error: 'Supabase is not configured.' };
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return { error: error ? friendlyAuthError(error.message) : null };
      },
      async signOut() {
        await supabase?.auth.signOut();
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
