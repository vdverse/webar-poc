import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './features/auth/AuthProvider';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import HomePage from './pages/HomePage';

// The AR page pulls in MindAR (which bundles TensorFlow.js) and three.js —
// about 2 MB minified — so it is only loaded when the route is visited.
const ArProofPage = lazy(() => import('./pages/ArProofPage'));

// Auth and dashboard routes pull in @supabase/supabase-js and
// react-hook-form; keep them out of the / and /dev/ar-proof bundles too.
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const DashboardHomePage = lazy(() => import('./pages/dashboard/DashboardHomePage'));

export default function App() {
  // Deployments may serve the app under a sub-path (e.g. GitHub Pages uses
  // /<repo>/), so the router basename follows Vite's base setting.
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dev/ar-proof" element={<ArProofPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardHomePage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
