import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertCanPublish,
  assertPublishOwnership,
  buildPublicViewerUrl,
  makePublicSlug,
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
  bounds: {},
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
    expect(url).toBe('https://example.com/app/view/red-chair-11111111');
    expect(url).not.toMatch(/signed|token|storage/i);
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
