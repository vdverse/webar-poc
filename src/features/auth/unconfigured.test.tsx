/**
 * Verifies the unconfigured degradation path: when Supabase is not
 * available to the browser client, every auth/dashboard route must show a
 * clear notice instead of crashing or quietly redirecting.
 *
 * This suite mocks `supabaseClient` as unconfigured rather than relying on
 * a missing `.env.local`. Local developers (and this live-validation run)
 * have real credentials, so reading import.meta.env would otherwise flip
 * isConfigured to true and break these assertions.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

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
