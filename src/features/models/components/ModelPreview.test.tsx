import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../loadModelViewer', () => ({
  ensureModelViewerLoaded: vi.fn(async () => undefined),
}));

import { ModelPreview } from './ModelPreview';

afterEach(cleanup);

describe('ModelPreview AR attributes', () => {
  it('sets ar-placement floor and ar-scale fixed when AR is enabled', async () => {
    const { container } = render(
      <ModelPreview
        src="https://example.com/model.glb"
        alt="Test"
        ar
        arModes="webxr scene-viewer quick-look"
        arPlacement="floor"
        arScaleMode="fixed"
        viewerScale={0.25}
      />,
    );

    await vi.waitFor(() => {
      const el = container.querySelector('model-viewer');
      expect(el).toBeTruthy();
    });

    const el = container.querySelector('model-viewer')!;
    expect(el.getAttribute('ar-placement')).toBe('floor');
    expect(el.getAttribute('ar-scale')).toBe('fixed');
    expect(el.getAttribute('ar-modes')).toBe('webxr scene-viewer quick-look');
    expect(el.getAttribute('scale')).toBe('0.25 0.25 0.25');
  });
});
