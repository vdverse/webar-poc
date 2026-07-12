import { describe, expect, it } from 'vitest';

import {
  generatedModelPath,
  isValidSlug,
  publishedAssetPath,
  sanitizeFilename,
  slugify,
  sourceImagePath,
} from './storagePaths';

describe('sanitizeFilename', () => {
  it('keeps a normal filename unchanged', () => {
    expect(sanitizeFilename('cake-front.jpg')).toBe('cake-front.jpg');
  });

  it('strips path separators so it cannot escape the intended prefix', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\windows\\win.ini')).toBe('win.ini');
  });

  it('replaces unsafe characters', () => {
    expect(sanitizeFilename('my photo (final)!.jpg')).toBe('my_photo__final__.jpg');
  });

  it('falls back to a default name for an empty or fully-unsafe input', () => {
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('///')).toBe('file');
  });
});

describe('sourceImagePath', () => {
  it('matches the {userId}/{projectId}/{imageId}-{filename} convention', () => {
    expect(
      sourceImagePath({
        userId: 'user-1',
        projectId: 'proj-1',
        imageId: 'img-1',
        originalFilename: 'front.jpg',
      }),
    ).toBe('user-1/proj-1/img-1-front.jpg');
  });

  it('sanitizes the filename component', () => {
    expect(
      sourceImagePath({
        userId: 'user-1',
        projectId: 'proj-1',
        imageId: 'img-1',
        originalFilename: '../../secret.jpg',
      }),
    ).toBe('user-1/proj-1/img-1-secret.jpg');
  });
});

describe('generatedModelPath', () => {
  it('matches the {userId}/{projectId}/{modelId}.glb convention', () => {
    expect(
      generatedModelPath({ userId: 'user-1', projectId: 'proj-1', modelId: 'model-1' }),
    ).toBe('user-1/proj-1/model-1.glb');
  });
});

describe('publishedAssetPath', () => {
  it('matches the {projectId}/{publicationVersion}/{file} convention', () => {
    expect(
      publishedAssetPath({ projectId: 'proj-1', publicationVersion: 3, file: 'model.glb' }),
    ).toBe('proj-1/3/model.glb');
  });

  it('rejects a non-positive or non-integer version', () => {
    expect(() =>
      publishedAssetPath({ projectId: 'proj-1', publicationVersion: 0, file: 'qr.png' }),
    ).toThrow();
    expect(() =>
      publishedAssetPath({ projectId: 'proj-1', publicationVersion: 1.5, file: 'qr.png' }),
    ).toThrow();
  });
});

describe('isValidSlug / slugify', () => {
  it('accepts lowercase-hyphenated slugs and rejects everything else', () => {
    expect(isValidSlug('golden-retriever-cake')).toBe(true);
    expect(isValidSlug('Golden-Cake')).toBe(false);
    expect(isValidSlug('golden_cake')).toBe(false);
    expect(isValidSlug('golden--cake')).toBe(false);
    expect(isValidSlug('-golden')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });

  it('produces a slug that always satisfies isValidSlug', () => {
    const cases = ['My Awesome Cake!', 'Café  Table', '  leading/trailing  ', '日本語のケーキ'];
    for (const input of cases) {
      const slug = slugify(input);
      expect(isValidSlug(slug)).toBe(true);
    }
  });

  it('produces the expected slug for a typical title', () => {
    expect(slugify('My Awesome Birthday Cake!')).toBe('my-awesome-birthday-cake');
  });
});
