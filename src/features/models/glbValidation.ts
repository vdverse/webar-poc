/**
 * Direct-GLB upload validation (vertical slice).
 * Pure checks first; Three.js GLTFLoader confirms the file is a real scene
 * with at least one mesh. Does not upload anything.
 */

export const GLB_MAX_BYTES = 25 * 1024 * 1024;
export const GLB_WARN_BYTES = 15 * 1024 * 1024;
export const GLB_WARN_TRIANGLES = 250_000;
export const GLB_WARN_MESHES = 200;

const GLB_EXTENSION = /\.glb$/i;
const ALLOWED_MIME = new Set([
  'model/gltf-binary',
  'application/octet-stream',
  'application/gltf-binary',
]);

export interface GlbBounds {
  width: number;
  height: number;
  depth: number;
  min: [number, number, number];
  max: [number, number, number];
}

export interface GlbMetadata {
  fileSizeBytes: number;
  meshCount: number;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  animationNames: string[];
  bounds: GlbBounds;
  warnings: string[];
}

export type GlbValidationErrorCode =
  | 'empty'
  | 'too-large'
  | 'bad-extension'
  | 'bad-mime'
  | 'load-failed'
  | 'no-mesh';

export class GlbValidationError extends Error {
  code: GlbValidationErrorCode;
  constructor(code: GlbValidationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Extension + size + MIME without decoding geometry. */
export function assertGlbFileBasics(file: File): void {
  if (!file || file.size <= 0) {
    throw new GlbValidationError('empty', 'Choose a GLB file to upload.');
  }
  if (file.size > GLB_MAX_BYTES) {
    throw new GlbValidationError(
      'too-large',
      `GLB files must be ${GLB_MAX_BYTES / (1024 * 1024)} MB or smaller.`,
    );
  }
  if (!GLB_EXTENSION.test(file.name)) {
    throw new GlbValidationError('bad-extension', 'Only .glb files are accepted in this version.');
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    throw new GlbValidationError(
      'bad-mime',
      `Unexpected file type “${file.type}”. Use a .glb (model/gltf-binary) file.`,
    );
  }
}

function collectWarnings(meta: Omit<GlbMetadata, 'warnings'>): string[] {
  const warnings: string[] = [];
  if (meta.fileSizeBytes >= GLB_WARN_BYTES) {
    warnings.push('This model is large and may load slowly on phones.');
  }
  if (meta.triangleCount >= GLB_WARN_TRIANGLES) {
    warnings.push('High triangle count — AR performance may suffer on mid-range devices.');
  }
  if (meta.meshCount >= GLB_WARN_MESHES) {
    warnings.push('Many meshes — consider merging geometry before publishing.');
  }
  return warnings;
}

/**
 * Load the file with Three.js GLTFLoader and extract renderable metadata.
 * Rejects files that fail to parse or contain no mesh.
 */
export async function validateAndInspectGlb(file: File): Promise<GlbMetadata> {
  assertGlbFileBasics(file);

  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { Box3, Vector3 } = await import('three');

  const buffer = await file.arrayBuffer();
  const loader = new GLTFLoader();

  let gltf: Awaited<ReturnType<typeof loader.parseAsync>>;
  try {
    gltf = await loader.parseAsync(buffer, '');
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown parse error';
    throw new GlbValidationError('load-failed', `Could not read this GLB (${detail}).`);
  }

  let meshCount = 0;
  let triangleCount = 0;
  const materials = new Set<string>();
  const textures = new Set<unknown>();

  gltf.scene.traverse((obj) => {
    // Mesh and SkinnedMesh both expose geometry + material.
    const mesh = obj as {
      isMesh?: boolean;
      geometry?: { index?: { count: number } | null; attributes?: { position?: { count: number } } };
      material?: { uuid?: string; map?: unknown } | Array<{ uuid?: string; map?: unknown }>;
    };
    if (!mesh.isMesh || !mesh.geometry) return;
    meshCount += 1;
    const geo = mesh.geometry;
    if (geo.index) {
      triangleCount += Math.floor(geo.index.count / 3);
    } else if (geo.attributes?.position) {
      triangleCount += Math.floor(geo.attributes.position.count / 3);
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      if (m?.uuid) materials.add(m.uuid);
      if (m?.map) textures.add(m.map);
    }
  });

  if (meshCount < 1) {
    throw new GlbValidationError('no-mesh', 'This GLB has no renderable mesh.');
  }

  const box = new Box3().setFromObject(gltf.scene);
  const size = new Vector3();
  box.getSize(size);
  const min = box.min;
  const max = box.max;

  const base = {
    fileSizeBytes: file.size,
    meshCount,
    triangleCount,
    materialCount: materials.size,
    textureCount: textures.size,
    animationNames: (gltf.animations ?? []).map((a, i) => a.name || `Animation ${i + 1}`),
    bounds: {
      width: Number(size.x.toFixed(4)),
      height: Number(size.y.toFixed(4)),
      depth: Number(size.z.toFixed(4)),
      min: [Number(min.x.toFixed(4)), Number(min.y.toFixed(4)), Number(min.z.toFixed(4))] as [
        number,
        number,
        number,
      ],
      max: [Number(max.x.toFixed(4)), Number(max.y.toFixed(4)), Number(max.z.toFixed(4))] as [
        number,
        number,
        number,
      ],
    },
  };

  return { ...base, warnings: collectWarnings(base) };
}
