/**
 * Wizard behaviour tests. The data hooks are mocked at their module
 * boundary (that's the API edge); the wizard's own stage logic, guard
 * conditions and rendering run for real. Covers: resuming at the persisted
 * stage, source-method selection persisting via updateProject, the review
 * screen showing real metadata, and the saved screen exposing Generate (Batch 3).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ArProject, ProjectSourceImage } from '../../features/projects/types';

const mutateUpdate = vi.fn();

const baseProject: ArProject = {
  id: 'p1',
  owner_id: 'u1',
  name: 'Garden gnome',
  description: 'A cheerful gnome',
  slug: 'garden-gnome-abcd1234',
  mode: 'markerless_surface',
  status: 'draft',
  source_method: null,
  wizard_stage: 'source_method',
  thumbnail_path: null,
  published_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

let currentProject: ArProject = baseProject;
let currentImages: ProjectSourceImage[] = [];

vi.mock('../../features/generation/components/GenerationPanel', () => ({
  GenerationPanel: () => (
    <button type="button" disabled={false}>
      Generate 3D model
    </button>
  ),
}));

vi.mock('../../features/projects/api/projectHooks', () => ({
  useProjectQuery: () => ({
    data: currentProject,
    isPending: false,
    isError: false,
  }),
  useUpdateProjectMutation: () => ({
    mutate: mutateUpdate,
    isPending: false,
    isError: false,
  }),
}));

vi.mock('../../features/uploads/sourceImageHooks', () => ({
  useSourceImagesQuery: () => ({ data: currentImages, isPending: false, isError: false }),
  // ImageUploader also pulls these in; give them inert stubs.
  useUploadSourceImageMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useDeleteSourceImageMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useReorderSourceImagesMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useSignedPreviewQuery: () => ({ data: 'https://signed.example/x', isPending: false, isError: false }),
}));

vi.mock('../../features/models/modelHooks', () => ({
  useLatestModelQuery: () => ({ data: null, isPending: false, isError: false, refetch: vi.fn() }),
}));

vi.mock('../../features/models/components/GlbUploader', () => ({
  GlbUploader: () => <div data-testid="glb-uploader">GLB uploader</div>,
}));

// SignedThumb renders a real <img>; jsdom's canvas shim can't construct it,
// and it isn't the subject of these tests (its signed-URL behaviour is
// covered via the useSignedPreviewQuery hook). Stub it to a plain element.
vi.mock('../../features/uploads/components/SignedThumb', () => ({
  SignedThumb: ({ alt }: { alt: string }) => <div data-testid="thumb" aria-label={alt} />,
}));

import ProjectWizardPage from './ProjectWizardPage';

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/projects/p1']}>
      <Routes>
        <Route path="/dashboard/projects/:projectId" element={<ProjectWizardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  mutateUpdate.mockClear();
  currentProject = baseProject;
  currentImages = [];
});

describe('ProjectWizardPage', () => {
  it('resumes at the source-method step and persists the chosen method', () => {
    renderWizard();
    expect(screen.getByText(/how will you provide the object/i)).toBeTruthy();

    fireEvent.click(screen.getByText('Single image'));
    expect(mutateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        wizard_stage: 'capture',
        source_method: 'single_image',
      }),
    );
  });

  it('persists existing-GLB as the source method', () => {
    renderWizard();
    fireEvent.click(screen.getByText(/Upload an existing GLB/i));
    expect(mutateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        wizard_stage: 'capture',
        source_method: 'glb_upload',
      }),
    );
  });

  it('shows real image metadata on the review step', () => {
    currentProject = {
      ...baseProject,
      source_method: 'single_image',
      wizard_stage: 'review',
    };
    currentImages = [
      {
        id: 'img1',
        project_id: 'p1',
        owner_id: 'u1',
        storage_path: 'u1/p1/img1-gnome.jpg',
        original_filename: 'gnome.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 1024,
        width: 1200,
        height: 900,
        angle_label: null,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    renderWizard();
    expect(screen.getByText(/check everything before saving/i)).toBeTruthy();
    expect(screen.getByText('gnome.jpg')).toBeTruthy();
    expect(screen.getByText('1200×900')).toBeTruthy();
    expect(screen.getByText('Single image')).toBeTruthy();
  });

  it('offers generate actions on the saved step for photo projects', () => {
    currentProject = {
      ...baseProject,
      source_method: 'single_image',
      wizard_stage: 'saved',
    };
    renderWizard();
    expect(screen.getByRole('button', { name: /Generate 3D model/i })).toBeTruthy();
    expect(screen.getByText(/Generate a textured GLB on the server/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open generation page/i })).toBeTruthy();
  });

  it('blocks the review step when no source method is set', () => {
    currentProject = { ...baseProject, source_method: null, wizard_stage: 'capture' };
    renderWizard();
    expect(screen.getByText(/Choose a source method first/i)).toBeTruthy();
  });
});
