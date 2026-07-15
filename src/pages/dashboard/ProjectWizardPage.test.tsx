/**
 * Wizard behaviour tests. The data hooks are mocked at their module
 * boundary; the wizard's own stage logic and saved-step CTAs run for real.
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
let latestModel: { id: string } | null = null;
let latestJob: { status: string } | null = null;

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
  useUploadSourceImageMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useDeleteSourceImageMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useReorderSourceImagesMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useSignedPreviewQuery: () => ({ data: 'https://signed.example/x', isPending: false, isError: false }),
}));

vi.mock('../../features/models/modelHooks', () => ({
  useLatestModelQuery: () => ({
    data: latestModel,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../features/generation/api/generationHooks', () => ({
  useLatestGenerationJobQuery: () => ({ data: latestJob, isPending: false }),
  useCreateGenerationMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  useCancelGenerationMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useGenerationStatusPolling: () => undefined,
}));

vi.mock('../../features/models/components/GlbUploader', () => ({
  GlbUploader: () => <div data-testid="glb-uploader">GLB uploader</div>,
}));

vi.mock('../../features/uploads/components/SignedThumb', () => ({
  SignedThumb: ({ alt }: { alt: string }) => <div data-testid="thumb" aria-label={alt} />,
}));

import ProjectWizardPage from './ProjectWizardPage';

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/projects/p1']}>
      <Routes>
        <Route path="/dashboard/projects/:projectId" element={<ProjectWizardPage />} />
        <Route path="/dashboard/projects/:projectId/generate" element={<div>Generate page</div>} />
        <Route path="/dashboard/projects/:projectId/studio" element={<div>Studio page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  mutateUpdate.mockClear();
  currentProject = baseProject;
  currentImages = [];
  latestModel = null;
  latestJob = null;
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

  it('shows an enabled Generate link to the generation page for saved single-image projects', () => {
    currentProject = {
      ...baseProject,
      source_method: 'single_image',
      wizard_stage: 'saved',
      status: 'draft',
    };
    currentImages = [
      {
        id: 'img1',
        project_id: 'p1',
        owner_id: 'u1',
        storage_path: 'u1/p1/img1.jpg',
        original_filename: 'a.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 10,
        width: 1200,
        height: 900,
        angle_label: null,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    renderWizard();
    const link = screen.getByRole('link', { name: /^Generate 3D model$/i });
    expect((link as HTMLAnchorElement).getAttribute('href')).toBe('/dashboard/projects/p1/generate');
    expect(screen.getByText(/photos are ready/i)).toBeTruthy();
    expect(screen.queryByText(/coming in Batch 3/i)).toBeNull();
  });

  it('shows Open GLB Studio when the photo project already has a model', () => {
    currentProject = {
      ...baseProject,
      source_method: 'single_image',
      wizard_stage: 'saved',
      status: 'published',
    };
    currentImages = [
      {
        id: 'img1',
        project_id: 'p1',
        owner_id: 'u1',
        storage_path: 'u1/p1/img1.jpg',
        original_filename: 'a.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 10,
        width: 1200,
        height: 900,
        angle_label: null,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    latestModel = { id: 'm1' };
    latestJob = { status: 'completed' };
    renderWizard();
    const link = screen.getByRole('link', { name: /Open GLB Studio/i });
    expect((link as HTMLAnchorElement).getAttribute('href')).toBe('/dashboard/projects/p1/studio');
  });

  it('shows View generation progress while a job is active', () => {
    currentProject = {
      ...baseProject,
      source_method: 'single_image',
      wizard_stage: 'saved',
      status: 'generating',
    };
    currentImages = [
      {
        id: 'img1',
        project_id: 'p1',
        owner_id: 'u1',
        storage_path: 'u1/p1/img1.jpg',
        original_filename: 'a.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 10,
        width: 1200,
        height: 900,
        angle_label: null,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    latestJob = { status: 'processing' };
    renderWizard();
    expect(screen.getByRole('link', { name: /View generation progress/i })).toBeTruthy();
  });

  it('disables Generate with a clear reason when images are missing', () => {
    currentProject = {
      ...baseProject,
      source_method: 'single_image',
      wizard_stage: 'saved',
    };
    currentImages = [];
    renderWizard();
    const btn = screen.getByRole('button', { name: /Generate 3D model/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/exactly one/i)).toBeTruthy();
  });

  it('offers Open GLB studio for direct GLB projects', () => {
    currentProject = {
      ...baseProject,
      source_method: 'glb_upload',
      wizard_stage: 'saved',
      status: 'generated',
    };
    latestModel = { id: 'm1' };
    renderWizard();
    expect(screen.getByRole('link', { name: /Open GLB studio/i })).toBeTruthy();
    expect(screen.queryByText(/coming in Batch 3/i)).toBeNull();
  });

  it('blocks the review step when no source method is set', () => {
    currentProject = { ...baseProject, source_method: null, wizard_stage: 'capture' };
    renderWizard();
    expect(screen.getByText(/Choose a source method first/i)).toBeTruthy();
  });
});
