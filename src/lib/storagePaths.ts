/**
 * Storage path builders. Every path shape here must match the convention
 * baked into supabase/migrations/0010_storage_buckets_and_policies.sql
 * exactly — the private-bucket RLS policies authorise access by reading the
 * first path segment as the owning user's uid, so a mismatch here would
 * either lock owners out of their own files or (worse) let path-guessing
 * leak into another user's prefix.
 */

const FILENAME_SAFE = /[^a-zA-Z0-9._-]/g;

/** Strip anything that isn't a safe filename character, to block path traversal via a crafted original filename. */
export function sanitizeFilename(original: string): string {
  const base = original.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base.replace(FILENAME_SAFE, '_');
  return cleaned.length > 0 ? cleaned.slice(-120) : 'file';
}

export interface SourceImagePathInput {
  userId: string;
  projectId: string;
  imageId: string;
  originalFilename: string;
}

/** {userId}/{projectId}/{imageId}-{sanitizedFilename} in source-images-private. */
export function sourceImagePath({
  userId,
  projectId,
  imageId,
  originalFilename,
}: SourceImagePathInput): string {
  return `${userId}/${projectId}/${imageId}-${sanitizeFilename(originalFilename)}`;
}

export interface GeneratedModelPathInput {
  userId: string;
  projectId: string;
  modelId: string;
}

/** {userId}/{projectId}/{modelId}.glb in generated-models-private. */
export function generatedModelPath({
  userId,
  projectId,
  modelId,
}: GeneratedModelPathInput): string {
  return `${userId}/${projectId}/${modelId}.glb`;
}

export type PublishedAssetFile =
  | 'model.glb'
  | 'model.usdz'
  | 'poster.webp'
  | 'qr.svg'
  | 'qr.png';

export interface PublishedAssetPathInput {
  projectId: string;
  publicationVersion: number;
  file: PublishedAssetFile;
}

/** {projectId}/{publicationVersion}/{file} in the public published-ar-assets bucket. */
export function publishedAssetPath({
  projectId,
  publicationVersion,
  file,
}: PublishedAssetPathInput): string {
  if (!Number.isInteger(publicationVersion) || publicationVersion < 1) {
    throw new Error(`publicationVersion must be a positive integer, got ${publicationVersion}`);
  }
  return `${projectId}/${publicationVersion}/${file}`;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Matches the `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` check constraints in the migrations. */
export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** Lowercase, hyphenate, and strip anything outside [a-z0-9-] so the result always satisfies isValidSlug. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'project';
}
