import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ModelPreviewProps } from '../features/models/components/ModelPreview';

vi.mock('../lib/env', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'x'.repeat(40),
    VITE_PUBLIC_APP_URL: 'https://example.com',
  },
  isSupabaseConfigured: true,
}));

const capturedPreview: { current: ModelPreviewProps | null } = { current: null };

vi.mock('../features/models/publishService', () => ({
  getActivePublicationBySlug: vi.fn(async (slug: string) => {
    if (slug === 'missing-one') return null;
    return {
      id: 'pub1',
      project_id: 'p1',
      owner_id: 'u1',
      public_slug: slug,
      version: 1,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      snapshot: {
        title: 'Demo Chair',
        description: 'A demo',
        glbPublicPath: 'p1/1/model.glb',
        glbPublicUrl:
          'https://example.supabase.co/storage/v1/object/public/published-ar-assets/p1/1/model.glb',
        usdzPublicUrl: null,
        posterPublicUrl: null,
        scene: {
          scale: 1,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          placementMode: 'floor',
          shadowIntensity: 1,
          autoRotate: true,
          cameraControls: true,
          animationName: null,
          animationAutoplay: true,
          animationLoop: true,
          physicalWidth: 0.2,
          physicalHeight: 0.3,
          physicalDepth: 0.2,
          physicalSizeEstimated: false,
          effectiveScale: 0.1,
          arScaleMode: 'fixed',
        },
        modelBounds: {
          width: 2,
          height: 3,
          depth: 2,
          min: [-1, 0, -1],
          max: [1, 3, 1],
        },
        arModes: 'webxr scene-viewer',
        publishedAt: '2026-01-01T00:00:00Z',
      },
    };
  }),
}));

vi.mock('../features/models/components/ModelPreview', () => ({
  ModelPreview: (props: ModelPreviewProps) => {
    capturedPreview.current = props;
    return <div data-testid="preview">preview</div>;
  },
}));

import PublicViewerPage from './PublicViewerPage';

function renderAt(slug: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/view/${slug}`]}>
        <Routes>
          <Route path="/view/:publicSlug" element={<PublicViewerPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  capturedPreview.current = null;
});

describe('PublicViewerPage', () => {
  it('shows a missing-publication state', async () => {
    renderAt('missing-one');
    expect(await screen.findByText(/Experience not found/i)).toBeTruthy();
  });

  it('renders title and 3D preview for an active publication', async () => {
    renderAt('demo-chair');
    expect(await screen.findByText('Demo Chair')).toBeTruthy();
    expect(screen.getByTestId('preview')).toBeTruthy();
    expect(screen.getByText(/View in your space/i)).toBeTruthy();
  });

  it('passes floor placement and fixed AR scale to model-viewer', async () => {
    renderAt('demo-chair');
    await screen.findByText('Demo Chair');
    expect(capturedPreview.current?.arPlacement).toBe('floor');
    expect(capturedPreview.current?.arScaleMode).toBe('fixed');
    expect(capturedPreview.current?.arModes).toBe('webxr scene-viewer');
    expect(capturedPreview.current?.viewerScale).toBe(0.1);
  });

  it('shows AR placement instructions before launch', async () => {
    renderAt('demo-chair');
    expect(await screen.findByText(/scan the floor or table/i)).toBeTruthy();
    expect(screen.getByText(/tap to place/i)).toBeTruthy();
  });

  it('shows AR troubleshooting guidance', async () => {
    renderAt('demo-chair');
    await screen.findByText('Demo Chair');
    expect(screen.getByText(/AR troubleshooting/i)).toBeTruthy();
  });
});
