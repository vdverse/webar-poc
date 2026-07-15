/**
 * Markerless AR placement helpers for model-viewer.
 * glTF units are metres; scale attribute multiplies the authored size.
 */

import type { GlbBounds } from './glbValidation';
import type { ArScaleMode, PlacementMode } from './types';

export const AR_MODES_ORDERED = 'webxr scene-viewer quick-look';
export const AR_MODES_WITHOUT_QUICK_LOOK = 'webxr scene-viewer';

export const DEFAULT_TARGET_LONGEST_M = 0.35;
export const MIN_TARGET_LONGEST_M = 0.3;
export const MAX_TARGET_LONGEST_M = 0.5;
export const MIN_PHYSICAL_M = 0.01;
export const MAX_PHYSICAL_M = 10;
export const MIN_VIEWER_SCALE = 1e-6;
export const MAX_VIEWER_SCALE = 1000;

export type ArPlacement = 'floor' | 'wall';

export function buildArModes(hasUsdz: boolean): string {
  return hasUsdz ? AR_MODES_ORDERED : AR_MODES_WITHOUT_QUICK_LOOK;
}

export function mapPlacementModeToArPlacement(mode: PlacementMode): ArPlacement {
  return mode === 'wall' ? 'wall' : 'floor';
}

export function isValidPhysicalDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_PHYSICAL_M &&
    value <= MAX_PHYSICAL_M
  );
}

export function parsePhysicalDimensionInput(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 'invalid';
  if (n <= 0 || n < MIN_PHYSICAL_M || n > MAX_PHYSICAL_M) return 'invalid';
  return n;
}

export function collectInvalidPhysicalDimensionFields(input: {
  physicalWidth?: number | null;
  physicalHeight?: number | null;
  physicalDepth?: number | null;
}): string[] {
  const invalid: string[] = [];
  if (input.physicalWidth != null && !isValidPhysicalDimension(input.physicalWidth)) {
    invalid.push('physical width');
  }
  if (input.physicalHeight != null && !isValidPhysicalDimension(input.physicalHeight)) {
    invalid.push('physical height');
  }
  if (input.physicalDepth != null && !isValidPhysicalDimension(input.physicalDepth)) {
    invalid.push('physical depth');
  }
  return invalid;
}

export function normalizeGlbBounds(bounds: unknown): GlbBounds | null {
  if (!bounds || typeof bounds !== 'object') return null;
  const b = bounds as Partial<GlbBounds>;
  const width = Number(b.width);
  const height = Number(b.height);
  const depth = Number(b.depth);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(depth) ||
    width <= 0 ||
    height <= 0 ||
    depth <= 0
  ) {
    return null;
  }
  const min = Array.isArray(b.min) ? b.min.map(Number) : null;
  const max = Array.isArray(b.max) ? b.max.map(Number) : null;
  if (
    !min ||
    !max ||
    min.length !== 3 ||
    max.length !== 3 ||
    min.some((n) => !Number.isFinite(n)) ||
    max.some((n) => !Number.isFinite(n))
  ) {
    return {
      width,
      height,
      depth,
      min: [0, 0, 0],
      max: [width, height, depth],
    };
  }
  return { width, height, depth, min: min as [number, number, number], max: max as [number, number, number] };
}

type BoundAxis = 'width' | 'height' | 'depth';

function longestAxis(bounds: GlbBounds): { axis: BoundAxis; value: number } {
  const entries: [BoundAxis, number][] = [
    ['width', bounds.width],
    ['height', bounds.height],
    ['depth', bounds.depth],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return { axis: entries[0][0], value: entries[0][1] };
}

function axisValue(bounds: GlbBounds, axis: BoundAxis): number {
  return bounds[axis];
}

export function deriveDefaultPhysicalDimensions(bounds: GlbBounds): {
  width: number;
  height: number;
  depth: number;
  estimated: true;
  targetLongestM: number;
} {
  const { value } = longestAxis(bounds);
  const targetLongestM = DEFAULT_TARGET_LONGEST_M;
  const factor = targetLongestM / value;
  return {
    width: Number((bounds.width * factor).toFixed(4)),
    height: Number((bounds.height * factor).toFixed(4)),
    depth: Number((bounds.depth * factor).toFixed(4)),
    estimated: true,
    targetLongestM,
  };
}

export function resolvePhysicalDimensions(input: {
  physicalWidth?: number | null;
  physicalHeight?: number | null;
  physicalDepth?: number | null;
  bounds?: GlbBounds | null;
}): {
  width: number;
  height: number;
  depth: number;
  estimated: boolean;
} {
  const hasAny =
    isValidPhysicalDimension(input.physicalWidth) ||
    isValidPhysicalDimension(input.physicalHeight) ||
    isValidPhysicalDimension(input.physicalDepth);

  if (hasAny) {
    const bounds = input.bounds;
    const fallback = bounds ? deriveDefaultPhysicalDimensions(bounds) : null;
    return {
      width: isValidPhysicalDimension(input.physicalWidth)
        ? input.physicalWidth
        : (fallback?.width ?? DEFAULT_TARGET_LONGEST_M),
      height: isValidPhysicalDimension(input.physicalHeight)
        ? input.physicalHeight
        : (fallback?.height ?? DEFAULT_TARGET_LONGEST_M),
      depth: isValidPhysicalDimension(input.physicalDepth)
        ? input.physicalDepth
        : (fallback?.depth ?? DEFAULT_TARGET_LONGEST_M),
      estimated: false,
    };
  }

  if (input.bounds) {
    const derived = deriveDefaultPhysicalDimensions(input.bounds);
    return {
      width: derived.width,
      height: derived.height,
      depth: derived.depth,
      estimated: true,
    };
  }

  const side = DEFAULT_TARGET_LONGEST_M;
  return { width: side, height: side, depth: side, estimated: true };
}

export function computeModelViewerScale(input: {
  sceneScale: number;
  bounds: GlbBounds | null;
  physicalWidth?: number | null;
  physicalHeight?: number | null;
  physicalDepth?: number | null;
}): { scale: number; estimated: boolean } {
  const sceneScale = Number(input.sceneScale);
  if (!Number.isFinite(sceneScale) || sceneScale <= 0) {
    return { scale: 1, estimated: true };
  }

  const resolved = resolvePhysicalDimensions({
    physicalWidth: input.physicalWidth,
    physicalHeight: input.physicalHeight,
    physicalDepth: input.physicalDepth,
    bounds: input.bounds,
  });

  if (!input.bounds) {
    const scale = clampViewerScale(sceneScale);
    return { scale, estimated: resolved.estimated };
  }

  let referenceAxis: BoundAxis = 'height';
  let targetM = resolved.height;

  if (isValidPhysicalDimension(input.physicalHeight)) {
    referenceAxis = 'height';
    targetM = input.physicalHeight;
  } else if (isValidPhysicalDimension(input.physicalWidth)) {
    referenceAxis = 'width';
    targetM = input.physicalWidth;
  } else if (isValidPhysicalDimension(input.physicalDepth)) {
    referenceAxis = 'depth';
    targetM = input.physicalDepth;
  } else {
    const longest = longestAxis(input.bounds);
    referenceAxis = longest.axis;
    targetM = axisValue(
      {
        width: resolved.width,
        height: resolved.height,
        depth: resolved.depth,
        min: input.bounds.min,
        max: input.bounds.max,
      },
      longest.axis,
    );
  }

  const fileSize = axisValue(input.bounds, referenceAxis);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { scale: clampViewerScale(sceneScale), estimated: resolved.estimated };
  }

  const unitFactor = targetM / fileSize;
  const scale = clampViewerScale(sceneScale * unitFactor);
  return { scale, estimated: resolved.estimated };
}

function clampViewerScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(MAX_VIEWER_SCALE, Math.max(MIN_VIEWER_SCALE, scale));
}

export function evaluateFloorAlignment(bounds: GlbBounds | null): {
  centeredXZ: boolean;
  bottomNearOrigin: boolean;
  notes: string[];
} {
  if (!bounds) {
    return {
      centeredXZ: false,
      bottomNearOrigin: false,
      notes: ['Model bounds unavailable — floor alignment cannot be verified.'],
    };
  }

  const [minX, minY, minZ] = bounds.min;
  const [maxX, , maxZ] = bounds.max;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const centeredXZ = Math.abs(centerX) < bounds.width * 0.15 && Math.abs(centerZ) < bounds.depth * 0.15;
  const bottomNearOrigin = Math.abs(minY) < bounds.height * 0.1;
  const notes: string[] = [];

  if (!centeredXZ) {
    notes.push('Model origin is off-centre on X/Z — it may appear shifted when placed on a surface.');
  }
  if (!bottomNearOrigin) {
    notes.push('Model bottom is not near Y=0 — it may float above or sink below the detected floor.');
  }
  if (centeredXZ && bottomNearOrigin) {
    notes.push('Bounding box is centred on X/Z with its base near Y=0.');
  }

  return { centeredXZ, bottomNearOrigin, notes };
}

export function resolveArScaleMode(raw: unknown): ArScaleMode {
  return raw === 'auto' ? 'auto' : 'fixed';
}

export function describeArStatus(status: string): string {
  switch (status) {
    case 'not-presenting':
      return 'AR not active';
    case 'session-started':
      return 'AR session started — scan a surface and tap to place';
    case 'object-placed':
      return 'Object placed — walk around to view from different angles';
    case 'failed':
      return 'AR failed to start';
    default:
      return status;
  }
}

/** Dev-safe AR diagnostics (no URLs or credentials). */
export function formatArDiagnostics(input: {
  arPlacement: ArPlacement;
  arScaleMode: ArScaleMode;
  arModes: string;
  effectiveScale: number;
  physicalSizeEstimated: boolean;
  arStatus?: string;
  arTracking?: string;
}): string {
  const parts = [
    `placement=${input.arPlacement}`,
    `ar-scale=${input.arScaleMode}`,
    `modes=${input.arModes}`,
    `scale=${input.effectiveScale.toFixed(4)}`,
    input.physicalSizeEstimated ? 'size=estimated' : 'size=creator',
  ];
  if (input.arStatus) parts.push(`status=${input.arStatus}`);
  if (input.arTracking) parts.push(`tracking=${input.arTracking}`);
  return parts.join(' · ');
}
