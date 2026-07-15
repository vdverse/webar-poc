import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertCanPublish,
  assertPublishOwnership,
  buildPublicViewerUrl,
  buildSnapshot,
  makePublicSlug,
  nextPublicationVersion,
  pickStablePublicSlug,
} from './publishService';
import { ProjectServiceError } from '../projects/api/projectService';
import { publishedAssetPath } from '../../lib/storagePaths';
import type { ArProject } from '../projects/types';
import type { GeneratedModel, SceneSettings } from './types';

const project: ArProject = {
  id: '11111111-1111-1111-1111-111111111111',
  owner_id: 'u1',
  name: 'Red Chair!',
  description: null,
  slug: 'red-chair',
  mode: 'markerless_surface',
  status: 'generated',
  source_method: 'glb_upload',
  wizard_stage: 'saved',
  thumbnail_path: null,
  published_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const model: GeneratedModel = {
  id: 'm1',
  project_id: project.id,
  generation_job_id: null,
  owner_id: 'u1',
  glb_storage_path: 'u1/p/m1.glb',
  usdz_storage_path: null,
  thumbnail_storage_path: null,
  original_provider_url: null,
  file_size_bytes: 10,
  triangle_count: 100,
  mesh_count: 1,
  material_count: 1,
  texture_count: 0,
  animation_names: [],
  bounds: {
    width: 2,
    height: 3,
    depth: 2,
    min: [-1, 0, -1],
    max: [1, 3, 1],
  },
  metadata: {},
  processing_status: 'ready',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const settings: SceneSettings = {
  project_id: project.id,
  owner_id: 'u1',
  model_id: 'm1',
  scale: 1,
  rotation_x: 0,
  rotation_y: 0,
  rotation_z: 0,
  placement_mode: 'floor',
  shadow_intensity: 1,
  auto_rotate: true,
  camera_controls: true,
  animation_name: null,
  animation_autoplay: true,
  animation_loop: true,
  viewer_config: {},
  updated_at: '2026-01-01T00:00:00Z',
};

describe('publish helpers', () => {
  it('builds a stable public slug from the project name and id', () => {
    const slug = makePublicSlug(project.name, project.id);
    expect(slug).toMatch(/^red-chair-/);
    expect(slug.endsWith('11111111')).toBe(true);
  });

  it('builds a public viewer URL that uses /view/:slug only', () => {
    const url = buildPublicViewerUrl('red-chair-11111111', 'https://example.com/app');
    expect(url).toBe('https://example.com/view/red-chair-11111111');
    expect(url).not.toMatch(/signed|token|storage/i);
  });

  it('builds production QR target from Vercel origin override', () => {
    const url = buildPublicViewerUrl('test-5e25fec4', 'https://webar-poc-one.vercel.app/');
    expect(url).toBe('https://webar-poc-one.vercel.app/view/test-5e25fec4');
    expect(url).not.toMatch(/localhost/);
  });

  it('builds LAN QR target from configured LAN origin', () => {
    const url = buildPublicViewerUrl('test-5e25fec4', 'https://192.168.1.207:5173');
    expect(url).toBe('https://192.168.1.207:5173/view/test-5e25fec4');
  });

  it('increments publication version from the latest row', () => {
    expect(nextPublicationVersion(null)).toBe(1);
    expect(nextPublicationVersion(1)).toBe(2);
    expect(nextPublicationVersion(7)).toBe(8);
  });

  it('keeps a stable public slug across republish', () => {
    expect(
      pickStablePublicSlug({
        projectName: 'test',
        projectId: '5e25fec4-6c74-4316-a795-b1bbe8993069',
        priorSlug: 'test-5e25fec4',
      }),
    ).toBe('test-5e25fec4');
    expect(
      pickStablePublicSlug({
        projectName: 'test',
        projectId: '5e25fec4-6c74-4316-a795-b1bbe8993069',
        priorSlug: null,
      }),
    ).toBe('test-5e25fec4');
  });

  it('documents versioned public asset paths for republish', () => {
    expect(
      publishedAssetPath({
        projectId: '5e25fec4-6c74-4316-a795-b1bbe8993069',
        publicationVersion: 2,
        file: 'model.glb',
      }),
    ).toBe('5e25fec4-6c74-4316-a795-b1bbe8993069/2/model.glb');
  });

  it('rejects publish without a ready GLB', () => {
    expect(() =>
      assertCanPublish({ project, model: null, settings }),
    ).toThrow(ProjectServiceError);
  });

  it('rejects publish without scene settings', () => {
    expect(() =>
      assertCanPublish({ project, model, settings: null }),
    ).toThrow(/scene settings/i);
  });

  it('accepts a ready project + model + settings', () => {
    expect(() => assertCanPublish({ project, model, settings })).not.toThrow();
  });

  it('rejects publishing another user’s project', () => {
    expect(() =>
      assertPublishOwnership({
        userId: 'other-user',
        project,
        model,
        settings,
      }),
    ).toThrow(/only publish your own/i);
  });

  it('rejects a model owned by someone else', () => {
    expect(() =>
      assertPublishOwnership({
        userId: 'u1',
        project,
        model: { ...model, owner_id: 'other' },
        settings,
      }),
    ).toThrow(/model does not belong/i);
  });

  it('accepts matching owner ids across project, model and settings', () => {
    expect(() =>
      assertPublishOwnership({ userId: 'u1', project, model, settings }),
    ).not.toThrow();
  });

  it('builds public asset paths as {projectId}/{version}/model.glb', () => {
    const path = publishedAssetPath({
      projectId: project.id,
      publicationVersion: 1,
      file: 'model.glb',
    });
    expect(path).toBe(`${project.id}/1/model.glb`);
    expect(path.split('/')[0]).toBe(project.id);
  });

  it('rejects invalid physical dimensions at publish time', () => {
    expect(() =>
      assertCanPublish({
        project,
        model,
        settings: {
          ...settings,
          viewer_config: { physicalHeight: -1 },
        },
      }),
    ).toThrow(/invalid physical size/i);
  });

  it('builds snapshot with finite positive scale and ordered AR modes', () => {
    const snapshot = buildSnapshot({
      project,
      settings: {
        ...settings,
        viewer_config: { physicalHeight: 0.3, arScaleMode: 'fixed' },
      },
      model,
      glbPublicPath: `${project.id}/1/model.glb`,
      glbPublicUrl: 'https://example.com/model.glb',
      usdzPublicUrl: null,
    });
    expect(snapshot.arModes).toBe('webxr scene-viewer');
    expect(snapshot.scene.placementMode).toBe('floor');
    expect(snapshot.scene.arScaleMode).toBe('fixed');
    expect(Number.isFinite(snapshot.scene.effectiveScale!)).toBe(true);
    expect(snapshot.scene.effectiveScale!).toBeGreaterThan(0);
    expect(snapshot.scene.physicalHeight).toBe(0.3);
    expect(snapshot.modelBounds?.height).toBe(3);
  });

  it('estimates physical size when creator dimensions are absent', () => {
    const snapshot = buildSnapshot({
      project,
      settings,
      model,
      glbPublicPath: `${project.id}/1/model.glb`,
      glbPublicUrl: 'https://example.com/model.glb',
      usdzPublicUrl: null,
    });
    expect(snapshot.scene.physicalSizeEstimated).toBe(true);
    expect(snapshot.scene.physicalHeight).toBeGreaterThan(0);
    expect(snapshot.scene.effectiveScale).toBeGreaterThan(0);
  });
});

describe('published-assets RLS migration', () => {
  it('qualifies storage.objects.name so project title cannot shadow the path', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/0014_fix_published_assets_path_rls.sql'),
      'utf8',
    );
    expect(sql).toMatch(/storage\.foldername\(storage\.objects\.name\)/);
    expect(sql).not.toMatch(/storage\.foldername\(p\.name\)/);
    expect(sql).not.toMatch(/storage\.foldername\(name\)/);
  });
});

describe('stable publication slug migration', () => {
  it('replaces global unique public_slug with active-only partial unique index', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/0016_stable_publication_slug.sql'),
      'utf8',
    );
    expect(sql).toMatch(/drop constraint if exists publications_public_slug_key/i);
    expect(sql).toMatch(/publications_one_active_per_slug/);
    expect(sql).toMatch(/where is_active/i);
  });
});
