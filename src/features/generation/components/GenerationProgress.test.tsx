import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { GenerationProgress } from './GenerationProgress';
import type { GenerationJob } from '../types';

vi.mock('../api/generationHooks', () => ({}));

afterEach(() => cleanup());

const job = (over: Partial<GenerationJob> = {}): GenerationJob => ({
  id: 'j1',
  project_id: 'p1',
  status: 'processing',
  stage: 'Building geometry',
  progress: 55,
  provider: 'mock',
  input_mode: 'single_image',
  safe_error_code: null,
  safe_error_message: null,
  created_at: '2026-07-16T12:00:00Z',
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  ...over,
});

describe('GenerationProgress', () => {
  it('shows provider progress only when mid-range', () => {
    render(
      <MemoryRouter>
        <GenerationProgress job={job({ progress: 55 })} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByText('55%')).toBeTruthy();
  });

  it('does not invent a progress bar at 0%', () => {
    render(
      <MemoryRouter>
        <GenerationProgress job={job({ progress: 0 })} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText(/progress is only shown when the provider reports it/i)).toBeTruthy();
  });

  it('shows failure next action', () => {
    render(
      <MemoryRouter>
        <GenerationProgress
          job={job({
            status: 'failed',
            progress: 0,
            safe_error_code: 'provider-generation-failed',
            safe_error_message: 'The provider could not build a 3D model from these photos.',
          })}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Try different photos/i)).toBeTruthy();
  });
});
