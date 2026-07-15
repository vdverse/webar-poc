/**
 * Lightweight GLB inspection from the JSON chunk (no Three.js).
 * Used by Edge ingestion and unit tests.
 */

export interface GlbJsonInspection {
  meshCount: number;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  animationNames: string[];
  bounds: {
    width: number;
    height: number;
    depth: number;
    min: [number, number, number];
    max: [number, number, number];
  };
  warnings: string[];
}

export function inspectGlbJsonChunk(bytes: Uint8Array): GlbJsonInspection {
  if (bytes.length < 12) throw new Error('GLB too short');
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'glTF') throw new Error('GLB magic missing');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}`);

  let offset = 12;
  let json: Record<string, unknown> | null = null;
  while (offset + 8 <= bytes.length) {
    const chunkLen = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    const chunk = bytes.subarray(offset, offset + chunkLen);
    offset += chunkLen;
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(chunk)) as Record<string, unknown>;
      break;
    }
  }
  if (!json) throw new Error('GLB JSON chunk missing');

  const meshes = (json.meshes as unknown[]) || [];
  const accessors = (json.accessors as Array<{ count?: number; min?: number[]; max?: number[] }>) || [];
  const meshCount = meshes.length;
  if (meshCount < 1) throw new Error('no mesh');

  let triangleCount = 0;
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  let haveBounds = false;

  for (const mesh of meshes as Array<{ primitives?: Array<Record<string, unknown>> }>) {
    for (const prim of mesh.primitives || []) {
      const mode = (prim.mode as number | undefined) ?? 4;
      if (mode !== 4) continue;
      const indices = prim.indices as number | undefined;
      const attrs = prim.attributes as Record<string, number> | undefined;
      if (indices != null && accessors[indices]) {
        triangleCount += Math.floor((accessors[indices].count || 0) / 3);
      } else if (attrs?.POSITION != null && accessors[attrs.POSITION]) {
        triangleCount += Math.floor((accessors[attrs.POSITION].count || 0) / 3);
      }
      if (attrs?.POSITION != null && accessors[attrs.POSITION]?.min && accessors[attrs.POSITION]?.max) {
        const a = accessors[attrs.POSITION];
        haveBounds = true;
        minX = Math.min(minX, a.min![0]);
        minY = Math.min(minY, a.min![1]);
        minZ = Math.min(minZ, a.min![2]);
        maxX = Math.max(maxX, a.max![0]);
        maxY = Math.max(maxY, a.max![1]);
        maxZ = Math.max(maxZ, a.max![2]);
      }
    }
  }

  const warnings: string[] = [];
  const bounds = haveBounds
    ? {
        width: Number((maxX - minX).toFixed(4)),
        height: Number((maxY - minY).toFixed(4)),
        depth: Number((maxZ - minZ).toFixed(4)),
        min: [Number(minX.toFixed(4)), Number(minY.toFixed(4)), Number(minZ.toFixed(4))] as [
          number,
          number,
          number,
        ],
        max: [Number(maxX.toFixed(4)), Number(maxY.toFixed(4)), Number(maxZ.toFixed(4))] as [
          number,
          number,
          number,
        ],
      }
    : (() => {
        warnings.push('Bounds fallback used; POSITION accessors lacked min/max.');
        return {
          width: 1,
          height: 1,
          depth: 1,
          min: [0, 0, 0] as [number, number, number],
          max: [1, 1, 1] as [number, number, number],
        };
      })();

  if (triangleCount >= 250_000) {
    warnings.push('High triangle count — AR performance may suffer on mid-range devices.');
  }

  const materials = (json.materials as unknown[]) || [];
  const textures = (json.textures as unknown[]) || [];
  const animations = (json.animations as Array<{ name?: string }>) || [];

  return {
    meshCount,
    triangleCount,
    materialCount: materials.length,
    textureCount: textures.length,
    animationNames: animations.map((a, i) => a.name || `Animation ${i + 1}`),
    bounds,
    warnings,
  };
}
