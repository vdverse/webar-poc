import { describe, expect, it } from 'vitest';

import {
  angleLabelSchema,
  projectFormSchema,
  sourceImageMetadataSchema,
  sourceMethodSchema,
  wizardStageSchema,
} from './projectSchema';

describe('projectFormSchema', () => {
  it('accepts a valid project', () => {
    const result = projectFormSchema.safeParse({
      name: 'Birthday cake',
      description: 'A golden retriever cake',
      mode: 'markerless_surface',
    });
    expect(result.success).toBe(true);
  });

  it('trims and rejects an empty name', () => {
    expect(projectFormSchema.safeParse({ name: '   ', mode: 'markerless_surface' }).success).toBe(false);
  });

  it('rejects an over-long name', () => {
    expect(
      projectFormSchema.safeParse({ name: 'x'.repeat(121), mode: 'markerless_surface' }).success,
    ).toBe(false);
  });

  it('rejects an unknown mode', () => {
    expect(
      projectFormSchema.safeParse({ name: 'ok', mode: 'hologram' }).success,
    ).toBe(false);
  });

  it('allows an empty description', () => {
    expect(
      projectFormSchema.safeParse({ name: 'ok', description: '', mode: 'image_target' }).success,
    ).toBe(true);
  });
});

describe('sourceMethodSchema / wizardStageSchema / angleLabelSchema', () => {
  it('accepts every allowed source method and rejects others', () => {
    for (const m of ['single_image', 'multi_view', 'glb_upload']) {
      expect(sourceMethodSchema.safeParse(m).success).toBe(true);
    }
    expect(sourceMethodSchema.safeParse('video').success).toBe(false);
  });

  it('accepts every allowed wizard stage and rejects others', () => {
    for (const s of ['details', 'source_method', 'capture', 'review', 'saved']) {
      expect(wizardStageSchema.safeParse(s).success).toBe(true);
    }
    expect(wizardStageSchema.safeParse('publish').success).toBe(false);
  });

  it('accepts every documented angle label and rejects others', () => {
    for (const a of [
      'front', 'front-right', 'right', 'back-right', 'back',
      'back-left', 'left', 'front-left', 'top', 'detail',
    ]) {
      expect(angleLabelSchema.safeParse(a).success).toBe(true);
    }
    expect(angleLabelSchema.safeParse('bottom').success).toBe(false);
  });
});

describe('sourceImageMetadataSchema', () => {
  const valid = {
    storage_path: 'u/p/img-front.jpg',
    original_filename: 'front.jpg',
    mime_type: 'image/jpeg',
    file_size_bytes: 1024,
    width: 800,
    height: 600,
    angle_label: 'front',
    sort_order: 0,
  };

  it('accepts valid metadata', () => {
    expect(sourceImageMetadataSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a null angle label', () => {
    expect(sourceImageMetadataSchema.safeParse({ ...valid, angle_label: null }).success).toBe(true);
  });

  it('rejects a non-image MIME type', () => {
    expect(
      sourceImageMetadataSchema.safeParse({ ...valid, mime_type: 'application/pdf' }).success,
    ).toBe(false);
  });

  it('rejects non-positive dimensions', () => {
    expect(sourceImageMetadataSchema.safeParse({ ...valid, width: 0 }).success).toBe(false);
  });
});
