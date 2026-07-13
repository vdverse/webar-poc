import { describe, expect, it } from 'vitest';

import {
  checkImageRules,
  checkImageSetRules,
  hasBlockingIssue,
  MULTI_VIEW_IMAGE_MAX_BYTES,
  MULTI_VIEW_MAX_IMAGES,
  MULTI_VIEW_MIN_IMAGES,
  SINGLE_IMAGE_MAX_BYTES,
  type CandidateImage,
} from './imageValidation';

const MB = 1024 * 1024;

function candidate(overrides: Partial<CandidateImage> = {}): CandidateImage {
  return {
    filename: 'front.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 2 * MB,
    width: 1600,
    height: 1200,
    ...overrides,
  };
}

describe('checkImageRules', () => {
  it('passes a clean JPEG', () => {
    expect(checkImageRules(candidate(), SINGLE_IMAGE_MAX_BYTES)).toEqual([]);
  });

  it('rejects unsupported MIME types', () => {
    const issues = checkImageRules(
      candidate({ mimeType: 'image/gif', filename: 'anim.gif' }),
      SINGLE_IMAGE_MAX_BYTES,
    );
    expect(issues.some((i) => i.code === 'unsupported-type' && i.level === 'error')).toBe(true);
  });

  it('rejects an extension that does not match the MIME type', () => {
    const issues = checkImageRules(
      candidate({ filename: 'photo.png', mimeType: 'image/jpeg' }),
      SINGLE_IMAGE_MAX_BYTES,
    );
    expect(issues.some((i) => i.code === 'extension-mismatch')).toBe(true);
  });

  it('accepts .jpeg as well as .jpg for image/jpeg', () => {
    expect(
      checkImageRules(candidate({ filename: 'photo.jpeg' }), SINGLE_IMAGE_MAX_BYTES),
    ).toEqual([]);
  });

  it('enforces the 15 MB single-image cap', () => {
    const issues = checkImageRules(
      candidate({ sizeBytes: 15 * MB + 1 }),
      SINGLE_IMAGE_MAX_BYTES,
    );
    expect(issues.some((i) => i.code === 'too-large')).toBe(true);
  });

  it('enforces the 10 MB multi-view cap', () => {
    const under = checkImageRules(candidate({ sizeBytes: 10 * MB }), MULTI_VIEW_IMAGE_MAX_BYTES);
    const over = checkImageRules(candidate({ sizeBytes: 10 * MB + 1 }), MULTI_VIEW_IMAGE_MAX_BYTES);
    expect(under).toEqual([]);
    expect(over.some((i) => i.code === 'too-large')).toBe(true);
  });

  it('warns (not errors) on low resolution', () => {
    const issues = checkImageRules(
      candidate({ width: 400, height: 300 }),
      SINGLE_IMAGE_MAX_BYTES,
    );
    const lowRes = issues.find((i) => i.code === 'low-resolution');
    expect(lowRes?.level).toBe('warning');
    expect(hasBlockingIssue(issues)).toBe(false);
  });
});

describe('checkImageSetRules', () => {
  const opts = { minImages: MULTI_VIEW_MIN_IMAGES, maxImages: MULTI_VIEW_MAX_IMAGES };

  it('rejects more than the maximum image count', () => {
    const many = Array.from({ length: 13 }, (_, i) => candidate({ filename: `a${i}.jpg` }));
    const issues = checkImageSetRules(many, opts);
    expect(issues.some((i) => i.code === 'too-many-images' && i.level === 'error')).toBe(true);
  });

  it('rejects fewer than the minimum image count', () => {
    const issues = checkImageSetRules([candidate()], opts);
    expect(issues.some((i) => i.code === 'too-few-images')).toBe(true);
  });

  it('accepts a valid multi-view set', () => {
    const set = Array.from({ length: 8 }, (_, i) =>
      candidate({ filename: `angle-${i}.jpg`, contentHash: `hash-${i}` }),
    );
    expect(checkImageSetRules(set, opts)).toEqual([]);
  });

  it('warns on duplicate filenames', () => {
    const issues = checkImageSetRules(
      [candidate(), candidate(), candidate({ filename: 'other.jpg' })],
      opts,
    );
    const dupes = issues.filter((i) => i.code === 'duplicate-name');
    expect(dupes).toHaveLength(1);
    expect(dupes[0].level).toBe('warning');
  });

  it('warns when two differently-named files have identical content', () => {
    const issues = checkImageSetRules(
      [
        candidate({ filename: 'a.jpg', contentHash: 'same' }),
        candidate({ filename: 'b.jpg', contentHash: 'same' }),
      ],
      opts,
    );
    expect(issues.some((i) => i.code === 'duplicate-content')).toBe(true);
  });
});
