import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mutateCreate = vi.fn();
let creditsRemaining: number | null = 3;

vi.mock('../../models/modelHooks', () => ({
  useLatestModelQuery: () => ({ data: null }),
}));

vi.mock('../api/generationHooks', () => ({
  useLatestGenerationJobQuery: () => ({ data: null }),
  useGenerationCreditsQuery: () => ({ data: creditsRemaining }),
  useCreateGenerationMutation: () => ({
    mutate: mutateCreate,
    isPending: false,
    isError: false,
    error: null,
  }),
  useCancelGenerationMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useGenerationStatusPolling: () => undefined,
}));

import { GenerationPanel } from './GenerationPanel';

afterEach(() => {
  cleanup();
  mutateCreate.mockReset();
  creditsRemaining = 3;
});

function renderPanel(imageCount = 1) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GenerationPanel
          projectId="p1"
          projectName="Gnome"
          sourceMethod="single_image"
          wizardStage="saved"
          imageCount={imageCount}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GenerationPanel', () => {
  it('enables Generate when photo project is ready', () => {
    renderPanel(1);
    const btn = screen.getByRole('button', { name: /Generate 3D model/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(mutateCreate).toHaveBeenCalled();
  });

  it('disables Generate when images are incomplete', () => {
    renderPanel(0);
    const btn = screen.getByRole('button', { name: /Generate 3D model/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disables Generate with a clear credits reason when remaining credits are 0', () => {
    creditsRemaining = 0;
    renderPanel(1);
    const btn = screen.getByRole('button', { name: /Generate 3D model/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/No generation credits remaining/i);
    expect(screen.queryByText(/development generation limit/i)).toBeNull();
  });
});
