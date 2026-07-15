/**
 * Source-image validation. The pure rules (checkImageRules) are separated
 * from the browser-dependent steps (decoding for dimensions, content
 * hashing) so the rules are directly unit-testable in jsdom.
 */

export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedMime = (typeof ACCEPTED_MIME_TYPES)[number];

const EXTENSION_FOR_MIME: Record<AcceptedMime, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

export const SINGLE_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const MULTI_VIEW_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MULTI_VIEW_MIN_IMAGES = 2;
export const MULTI_VIEW_MAX_IMAGES = 12;
/** Recommended shortest side for usable reconstruction (warning, not hard reject). */
export const RECOMMENDED_MIN_DIMENSION = 1024;

export interface ImageIssue {
  level: 'error' | 'warning';
  code:
    | 'unsupported-type'
    | 'extension-mismatch'
    | 'too-large'
    | 'low-resolution'
    | 'duplicate-name'
    | 'duplicate-content'
    | 'decode-failed'
    | 'too-many-images'
    | 'too-few-images';
  message: string;
}

export interface CandidateImage {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Undefined until decoded; a failed decode is its own error. */
  width?: number;
  height?: number;
  /** SHA-256 hex of the file bytes, when computed. */
  contentHash?: string;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

/** Pure per-file rules. maxBytes differs between single (15 MB) and multi-view (10 MB) modes. */
export function checkImageRules(
  candidate: CandidateImage,
  maxBytes: number,
): ImageIssue[] {
  const issues: ImageIssue[] = [];

  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(candidate.mimeType)) {
    issues.push({
      level: 'error',
      code: 'unsupported-type',
      message: `${candidate.filename}: only JPEG, PNG and WebP images are supported.`,
    });
    return issues; // no point checking further
  }

  const validExts = EXTENSION_FOR_MIME[candidate.mimeType as AcceptedMime];
  if (!validExts.includes(extensionOf(candidate.filename))) {
    issues.push({
      level: 'error',
      code: 'extension-mismatch',
      message: `${candidate.filename}: the file extension does not match its actual type.`,
    });
  }

  if (candidate.sizeBytes > maxBytes) {
    issues.push({
      level: 'error',
      code: 'too-large',
      message: `${candidate.filename}: larger than ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    });
  }

  if (
    candidate.width !== undefined &&
    candidate.height !== undefined &&
    Math.min(candidate.width, candidate.height) < RECOMMENDED_MIN_DIMENSION
  ) {
    // Warn, don't reject: low-res photos can still generate usable models.
    issues.push({
      level: 'warning',
      code: 'low-resolution',
      message: `${candidate.filename}: the shortest side is under ${RECOMMENDED_MIN_DIMENSION}px; the generated 3D model may lack detail.`,
    });
  }

  return issues;
}

/** Cross-file rules for a whole selection (duplicates, counts). */
export function checkImageSetRules(
  candidates: CandidateImage[],
  opts: { minImages: number; maxImages: number },
): ImageIssue[] {
  const issues: ImageIssue[] = [];

  if (candidates.length > opts.maxImages) {
    issues.push({
      level: 'error',
      code: 'too-many-images',
      message: `A maximum of ${opts.maxImages} images is supported; you selected ${candidates.length}.`,
    });
  }
  if (candidates.length < opts.minImages) {
    issues.push({
      level: 'error',
      code: 'too-few-images',
      message: `At least ${opts.minImages} images are needed for multi-view capture.`,
    });
  }

  const seenNames = new Map<string, number>();
  const seenHashes = new Map<string, string>();
  for (const c of candidates) {
    const nameCount = (seenNames.get(c.filename) ?? 0) + 1;
    seenNames.set(c.filename, nameCount);
    if (nameCount === 2) {
      issues.push({
        level: 'warning',
        code: 'duplicate-name',
        message: `${c.filename} appears more than once.`,
      });
    }
    if (c.contentHash) {
      const existing = seenHashes.get(c.contentHash);
      if (existing && existing !== c.filename) {
        issues.push({
          level: 'warning',
          code: 'duplicate-content',
          message: `${c.filename} has identical content to ${existing}.`,
        });
      } else if (!existing) {
        seenHashes.set(c.contentHash, c.filename);
      }
    }
  }

  return issues;
}

export function hasBlockingIssue(issues: ImageIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}

// ---------------------------------------------------------------------------
// Browser-dependent helpers (not unit-tested in jsdom; exercised manually and
// via the mocked component tests).
// ---------------------------------------------------------------------------

/** Decode with the browser to get true dimensions and prove the file isn't corrupt. */
export async function decodeImage(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    // createImageBitmap applies EXIF orientation ('from-image' is the
    // default per spec), so width/height reflect the displayed orientation.
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

export async function hashFileContent(file: File): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return undefined; // hashing is best-effort; duplicates become un-detectable, not fatal
  }
}

const COMPRESS_TRIGGER_BYTES = 4 * 1024 * 1024;
const COMPRESS_MAX_DIMENSION = 2560;

/**
 * Downscale/re-encode oversized camera photos client-side before upload.
 * Preserves aspect ratio exactly; keeps enough resolution (long side up to
 * 2560px) for image-to-3D generation; honours EXIF orientation because the
 * source bitmap is decoded with orientation applied. Returns the original
 * file untouched when it's already small enough.
 */
export async function compressForUpload(file: File): Promise<File> {
  if (file.size <= COMPRESS_TRIGGER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, COMPRESS_MAX_DIMENSION / longSide);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.87),
    );
    if (!blob || blob.size >= file.size) return file;
    const newName = file.name.replace(/\.(png|webp|jpeg|jpg)$/i, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file; // compression is an optimisation; never block the upload on it
  }
}
