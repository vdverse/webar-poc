import { describe, expect, it } from 'vitest';

/**
 * Mirrors supabase/functions/_shared/glbJsonInspect.ts for Vite unit tests
 * (Deno modules are not imported into the browser bundle).
 */

function inspectGlbJsonChunk(bytes: Uint8Array) {
  if (bytes.length < 12) throw new Error('GLB too short');
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'glTF') throw new Error('GLB magic missing');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let json: Record<string, unknown> | null = null;
  while (offset + 8 <= bytes.length) {
    const chunkLen = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    const chunk = bytes.subarray(offset, offset + chunkLen);
    offset += chunkLen;
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(chunk));
      break;
    }
  }
  if (!json) throw new Error('GLB JSON chunk missing');
  const meshes = (json.meshes as unknown[]) || [];
  if (meshes.length < 1) throw new Error('no mesh');
  return { meshCount: meshes.length };
}

function buildMinimalGlb(json: object): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunkLen = jsonBytes.length + jsonPad;
  const total = 12 + 8 + jsonChunkLen;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out[0] = 0x67;
  out[1] = 0x6c;
  out[2] = 0x54;
  out[3] = 0x46;
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunkLen, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  // GLB padding must be spaces (0x20), not nulls.
  for (let i = 0; i < jsonPad; i++) out[20 + jsonBytes.length + i] = 0x20;
  return out;
}

describe('inspectGlbJsonChunk', () => {
  it('rejects missing magic', () => {
    expect(() => inspectGlbJsonChunk(new Uint8Array(20).fill(0))).toThrow(/magic|too short/);
  });

  it('counts meshes from JSON chunk', () => {
    const bytes = buildMinimalGlb({
      asset: { version: '2.0' },
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ count: 3, min: [0, 0, 0], max: [1, 1, 1] }],
    });
    expect(inspectGlbJsonChunk(bytes).meshCount).toBe(1);
  });

  it('rejects empty mesh list', () => {
    const bytes = buildMinimalGlb({ asset: { version: '2.0' }, meshes: [] });
    expect(() => inspectGlbJsonChunk(bytes)).toThrow(/no mesh/);
  });
});
