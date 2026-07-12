import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';
import { SupabaseNotConfiguredNotice } from './SupabaseNotConfiguredNotice';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, isConfigured } = useAuth();
  const location = useLocation();

  if (!isConfigured) return <SupabaseNotConfiguredNotice />;

  // undefined = still checking the initial session; avoid a redirect flash.
  if (session === undefined) return null;

  if (session === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
