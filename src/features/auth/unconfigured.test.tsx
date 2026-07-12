/**
 * These tests run with no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set
 * (the default in this environment and in the GitHub Pages deployment),
 * so `supabase` is null and isConfigured is false throughout. That is
 * exactly the situation a real visitor hits today, and it's the one path
 * this suite can verify without a live Supabase project: every auth and
 * dashboard route must degrade to a clear message instead of crashing.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AuthProvider } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';

afterEach(cleanup);

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}

describe('unconfigured Supabase', () => {
  it('shows a configuration notice instead of a login form', async () => {
    const LoginPage = (await import('../../pages/auth/LoginPage')).default;
    renderWithProviders(<LoginPage />);
    expect(await screen.findByText('Backend not configured')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('shows a configuration notice instead of a register form', async () => {
    const RegisterPage = (await import('../../pages/auth/RegisterPage')).default;
    renderWithProviders(<RegisterPage />);
    expect(await screen.findByText('Backend not configured')).toBeTruthy();
  });

  it('shows a configuration notice for a protected route rather than redirecting', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>secret dashboard content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Backend not configured')).toBeTruthy();
    expect(screen.queryByText('secret dashboard content')).toBeNull();
  });

  it('mentions that /dev/ar-proof is unaffected', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div />
      </ProtectedRoute>,
    );
    expect(screen.getByText(/dev\/ar-proof/)).toBeTruthy();
  });
});
