import { describe, expect, it } from 'vitest';

import {
  assertGlbFileBasics,
  GLB_MAX_BYTES,
  GlbValidationError,
} from './glbValidation';

function file(name: string, size: number, type = 'model/gltf-binary'): File {
  const buf = new Uint8Array(Math.min(size, 16));
  return new File([buf], name, { type });
}

describe('assertGlbFileBasics', () => {
  it('accepts a reasonable .glb', () => {
    expect(() => assertGlbFileBasics(file('chair.glb', 1024))).not.toThrow();
  });

  it('rejects empty files', () => {
    expect(() => assertGlbFileBasics(file('empty.glb', 0))).toThrow(GlbValidationError);
  });

  it('rejects oversized files', () => {
    const big = file('big.glb', GLB_MAX_BYTES + 1);
    Object.defineProperty(big, 'size', { value: GLB_MAX_BYTES + 1 });
    expect(() => assertGlbFileBasics(big)).toThrow(/25 MB/i);
  });

  it('rejects non-glb extensions', () => {
    expect(() => assertGlbFileBasics(file('notes.txt', 12, 'text/plain'))).toThrow(/Only \.glb/i);
  });

  it('rejects mismatched MIME when provided', () => {
    expect(() => assertGlbFileBasics(file('chair.glb', 12, 'text/plain'))).toThrow(/Unexpected file type/i);
  });
});
