import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import HomePage from './pages/HomePage';

// The AR page pulls in MindAR (which bundles TensorFlow.js) and three.js —
// about 2 MB minified — so it is only loaded when the route is visited.
const ArProofPage = lazy(() => import('./pages/ArProofPage'));

export default function App() {
  // Deployments may serve the app under a sub-path (e.g. GitHub Pages uses
  // /<repo>/), so the router basename follows Vite's base setting.
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <BrowserRouter basename={basename}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dev/ar-proof" element={<ArProofPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
