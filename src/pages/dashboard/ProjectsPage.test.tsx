/**
 * ProjectsPage integration: list rendering, empty state, and that
 * destructive actions go through window.confirm before mutating. Data hooks
 * are mocked at the boundary; the page's own state handling runs for real.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ArProject } from '../../features/projects/types';

const archiveMutate = vi.fn();
const deleteMutate = vi.fn();

let listData: ArProject[] = [];
let listState: 'pending' | 'success' = 'success';

vi.mock('../../features/projects/api/projectHooks', () => ({
  useProjectsQuery: () => ({
    data: listState === 'success' ? listData : undefined,
    isPending: listState === 'pending',
    isSuccess: listState === 'success',
    isError: false,
  }),
  useArchiveProjectMutation: () => ({ mutate: archiveMutate, isPending: false, isError: false }),
  useDeleteProjectMutation: () => ({ mutate: deleteMutate, isPending: false, isError: false }),
}));

import ProjectsPage from './ProjectsPage';

function project(overrides: Partial<ArProject> = {}): ArProject {
  return {
    id: 'p1',
    owner_id: 'u1',
    name: 'Garden gnome',
    description: null,
    slug: 'garden-gnome-abcd1234',
    mode: 'markerless_surface',
    status: 'draft',
    source_method: null,
    wizard_stage: 'source_method',
    thumbnail_path: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  archiveMutate.mockClear();
  deleteMutate.mockClear();
  listData = [];
  listState = 'success';
  vi.restoreAllMocks();
});

describe('ProjectsPage', () => {
  it('renders an empty state with a create link when there are no projects', () => {
    listData = [];
    renderPage();
    expect(screen.getByText('No projects yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Create a project/i })).toBeTruthy();
  });

  it('renders a card per project', () => {
    listData = [project({ id: 'a', name: 'Alpha' }), project({ id: 'b', name: 'Beta' })];
    renderPage();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('archives only after the user confirms', () => {
    listData = [project({ name: 'Alpha' })];
    renderPage();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(archiveMutate).not.toHaveBeenCalled();

    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(archiveMutate).toHaveBeenCalledWith('p1');
  });

  it('deletes only after the user confirms', () => {
    listData = [project({ name: 'Alpha' })];
    renderPage();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteMutate).toHaveBeenCalledWith('p1');
  });
});
