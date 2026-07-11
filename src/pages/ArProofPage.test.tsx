/**
 * Desktop fallback tests. jsdom has neither WebGL nor a camera, which makes
 * it a faithful stand-in for the degraded-desktop path: the page must render,
 * the camera must not be touched before Start is pressed, and pressing Start
 * must produce a specific, human-readable error state rather than a crash.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ArProofPage from './ArProofPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Remove any test stubs of mediaDevices.
  delete (navigator as { mediaDevices?: unknown }).mediaDevices;
});

describe('ArProofPage desktop fallback', () => {
  it('renders the idle state with a Start AR button and does not touch the camera', () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    render(<ArProofPage />);
    expect(screen.getByRole('button', { name: 'Start AR' })).toBeTruthy();
    expect(screen.getByText(/camera turns on only after you press/i)).toBeTruthy();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(document.querySelector('video')).toBeNull();
  });

  it('shows the WebGL error state when WebGL is unavailable', async () => {
    render(<ArProofPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Start AR' }));
    expect(await screen.findByText('WebGL unavailable')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/WebGL is not available/);

    // Back returns to the idle state.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Start AR' })).toBeTruthy();
  });

  it('shows the no-camera error state when getUserMedia is unsupported', async () => {
    // Pretend WebGL exists so the camera check is reached.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as RenderingContext,
    );

    render(<ArProofPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Start AR' }));
    expect(await screen.findByText('No camera available')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/not supported/);
  });

  it('shows the camera-denied error state when permission is rejected', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as RenderingContext,
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      },
    });

    render(<ArProofPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Start AR' }));
    expect(await screen.findByText('Camera permission denied')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/Allow camera access/);
  });
});
