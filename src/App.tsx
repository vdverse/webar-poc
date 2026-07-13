import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './features/auth/AuthProvider';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import HomePage from './pages/HomePage';

// The AR page pulls in MindAR (which bundles TensorFlow.js) and three.js —
// about 2 MB minified — so it is only loaded when the route is visited.
const ArProofPage = lazy(() => import('./pages/ArProofPage'));

// Auth and dashboard routes pull in @supabase/supabase-js, TanStack Query
// and react-hook-form; keep them out of the / and /dev/ar-proof bundles.
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'));
const OverviewPage = lazy(() => import('./pages/dashboard/OverviewPage'));
const ProjectsPage = lazy(() => import('./pages/dashboard/ProjectsPage'));
const NewProjectPage = lazy(() => import('./pages/dashboard/NewProjectPage'));
const ProjectWizardPage = lazy(() => import('./pages/dashboard/ProjectWizardPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const NotAvailableYetPage = lazy(() => import('./pages/dashboard/NotAvailableYetPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  // Deployments may serve the app under a sub-path (e.g. GitHub Pages uses
  // /<repo>/), so the router basename follows Vite's base setting.
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <QueryClientProvider client={queryClient}>
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
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<OverviewPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/new" element={<NewProjectPage />} />
                <Route path="projects/:projectId" element={<ProjectWizardPage />} />
                <Route
                  path="projects/:projectId/source"
                  element={<ProjectWizardPage forceStage="capture" />}
                />
                <Route
                  path="generation-jobs"
                  element={
                    <NotAvailableYetPage
                      title="Generation Jobs"
                      batch="Batch 3"
                      description="Track image-to-3D generation jobs and their progress here."
                    />
                  }
                />
                <Route
                  path="published"
                  element={
                    <NotAvailableYetPage
                      title="Published Experiences"
                      batch="Batch 7"
                      description="Published AR experiences, public links and QR codes will live here."
                    />
                  }
                />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
