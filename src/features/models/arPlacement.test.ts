import { describe, expect, it } from 'vitest';

import {
  AR_MODES_ORDERED,
  AR_MODES_WITHOUT_QUICK_LOOK,
  buildArModes,
  collectInvalidPhysicalDimensionFields,
  computeModelViewerScale,
  deriveDefaultPhysicalDimensions,
  evaluateFloorAlignment,
  isValidPhysicalDimension,
  mapPlacementModeToArPlacement,
  parsePhysicalDimensionInput,
  resolveArScaleMode,
  resolvePhysicalDimensions,
} from './arPlacement';
import type { GlbBounds } from './glbValidation';

const bounds: GlbBounds = {
  width: 0.2,
  height: 3,
  depth: 0.2,
  min: [-0.1, 0, -0.1],
  max: [0.1, 3, 0.1],
};

describe('arPlacement', () => {
  it('orders AR modes webxr then scene-viewer then quick-look', () => {
    expect(AR_MODES_ORDERED).toBe('webxr scene-viewer quick-look');
    expect(buildArModes(true)).toBe(AR_MODES_ORDERED);
    expect(buildArModes(false)).toBe(AR_MODES_WITHOUT_QUICK_LOOK);
  });

  it('maps placement mode to model-viewer ar-placement', () => {
    expect(mapPlacementModeToArPlacement('floor')).toBe('floor');
    expect(mapPlacementModeToArPlacement('table')).toBe('floor');
    expect(mapPlacementModeToArPlacement('wall')).toBe('wall');
  });

  it('defaults ar-scale mode to fixed unless auto is chosen', () => {
    expect(resolveArScaleMode(undefined)).toBe('fixed');
    expect(resolveArScaleMode('fixed')).toBe('fixed');
    expect(resolveArScaleMode('auto')).toBe('auto');
  });

  it('rejects invalid physical dimensions', () => {
    expect(isValidPhysicalDimension(0)).toBe(false);
    expect(isValidPhysicalDimension(-1)).toBe(false);
    expect(isValidPhysicalDimension(NaN)).toBe(false);
    expect(isValidPhysicalDimension(Infinity)).toBe(false);
    expect(isValidPhysicalDimension(0.3)).toBe(true);
    expect(parsePhysicalDimensionInput('')).toBe(null);
    expect(parsePhysicalDimensionInput('0.3')).toBe(0.3);
    expect(parsePhysicalDimensionInput('abc')).toBe('invalid');
    expect(parsePhysicalDimensionInput('0')).toBe('invalid');
    expect(collectInvalidPhysicalDimensionFields({ physicalHeight: -2 })).toContain('physical height');
  });

  it('derives a sensible default physical size from bounds', () => {
    const derived = deriveDefaultPhysicalDimensions(bounds);
    expect(derived.estimated).toBe(true);
    expect(Math.max(derived.width, derived.height, derived.depth)).toBeGreaterThanOrEqual(0.3);
    expect(Math.max(derived.width, derived.height, derived.depth)).toBeLessThanOrEqual(0.5);
  });

  it('scales a tall GLB down to creator real-world height', () => {
    const { scale, estimated } = computeModelViewerScale({
      sceneScale: 1,
      bounds,
      physicalHeight: 0.3,
    });
    expect(estimated).toBe(false);
    expect(scale).toBeCloseTo(0.1, 4);
  });

  it('uses estimated size when creator dimensions are absent', () => {
    const resolved = resolvePhysicalDimensions({ bounds });
    expect(resolved.estimated).toBe(true);
    const { scale } = computeModelViewerScale({
      sceneScale: 1,
      bounds,
      physicalWidth: null,
      physicalHeight: null,
      physicalDepth: null,
    });
    expect(Number.isFinite(scale)).toBe(true);
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThan(1);
  });

  it('evaluates floor alignment from bounds', () => {
    const ok = evaluateFloorAlignment(bounds);
    expect(ok.bottomNearOrigin).toBe(true);
    expect(ok.notes.length).toBeGreaterThan(0);
  });
});
