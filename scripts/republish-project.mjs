/**
 * Republish an existing project (no Meshy). Uses service role to perform the
 * same versioned publish path after migration 0016.
 *
 * Usage:
 *   node scripts/republish-project.mjs 5e25fec4-6c74-4316-a795-b1bbe8993069
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function load(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
load('.env.local');

const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: node scripts/republish-project.mjs <projectId>');
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const json = execSync('supabase projects api-keys --project-ref codqgrxradxaloruoyys -o json', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const row = JSON.parse(json).find((k) => k.name === 'service_role');
const serviceKey = row?.api_key || row?.key || row?.value;
if (!url || !serviceKey) {
  console.error('Missing Supabase URL or service role key.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const PUBLIC_BUCKET = 'published-ar-assets';
const PRIVATE_BUCKET = 'generated-models-private';
const PUBLIC_APP = 'https://webar-poc-one.vercel.app';

const { data: project, error: projectError } = await admin
  .from('ar_projects')
  .select('*')
  .eq('id', projectId)
  .single();
if (projectError || !project) {
  console.error('project_missing', projectError?.message);
  process.exit(1);
}

const { data: models } = await admin
  .from('generated_models')
  .select('*')
  .eq('project_id', projectId)
  .order('created_at', { ascending: false })
  .limit(1);
const model = models?.[0];
if (!model) {
  console.error('model_missing');
  process.exit(1);
}

const { data: settings, error: settingsError } = await admin
  .from('scene_settings')
  .select('*')
  .eq('project_id', projectId)
  .maybeSingle();
if (settingsError || !settings) {
  console.error('settings_missing', settingsError?.message);
  process.exit(1);
}

const { data: prior } = await admin
  .from('publications')
  .select('id, version, public_slug, is_active')
  .eq('project_id', projectId)
  .order('version', { ascending: false });

const latestVersion = prior?.[0]?.version ?? 0;
const nextVersion = latestVersion + 1;
const priorActive = (prior || []).find((p) => p.is_active) ?? null;
const publicSlug = prior?.[0]?.public_slug || `ar-${projectId.replace(/-/g, '').slice(0, 8)}`;
const glbPublicPath = `${projectId}/${nextVersion}/model.glb`;

console.log('prior=', prior);
console.log('nextVersion=', nextVersion, 'slug=', publicSlug);

const { data: blob, error: dlError } = await admin.storage
  .from(PRIVATE_BUCKET)
  .download(model.glb_storage_path);
if (dlError || !blob) {
  console.error('private_download_failed', dlError?.message);
  process.exit(1);
}
const bytes = new Uint8Array(await blob.arrayBuffer());

const { error: upError } = await admin.storage.from(PUBLIC_BUCKET).upload(glbPublicPath, bytes, {
  contentType: 'model/gltf-binary',
  upsert: true,
});
if (upError) {
  console.error('public_upload_failed', upError.message);
  process.exit(1);
}

const glbPublicUrl = `${url.replace(/\/$/, '')}/storage/v1/object/public/${PUBLIC_BUCKET}/${glbPublicPath}`;
const snapshot = {
  title: project.name,
  description: project.description,
  glbPublicPath,
  glbPublicUrl,
  usdzPublicUrl: null,
  posterPublicUrl: null,
  scene: {
    scale: settings.scale,
    rotationX: settings.rotation_x,
    rotationY: settings.rotation_y,
    rotationZ: settings.rotation_z,
    placementMode: settings.placement_mode,
    shadowIntensity: settings.shadow_intensity,
    autoRotate: settings.auto_rotate,
    cameraControls: settings.camera_controls,
    animationName: settings.animation_name,
    animationAutoplay: settings.animation_autoplay,
    animationLoop: settings.animation_loop,
    physicalWidth: settings.viewer_config?.physicalWidth ?? null,
    physicalHeight: settings.viewer_config?.physicalHeight ?? null,
    physicalDepth: settings.viewer_config?.physicalDepth ?? null,
    arScaleMode: settings.viewer_config?.arScaleMode ?? 'fixed',
  },
  modelBounds: model.bounds ?? null,
  floorAlignmentNotes: [],
  arModes: 'webxr scene-viewer',
  publishedAt: new Date().toISOString(),
};

await admin.from('publications').update({ is_active: false }).eq('project_id', projectId).eq('is_active', true);

const { data: publication, error: insertError } = await admin
  .from('publications')
  .insert({
    project_id: projectId,
    owner_id: project.owner_id,
    public_slug: publicSlug,
    version: nextVersion,
    snapshot,
    is_active: true,
  })
  .select('*')
  .single();

if (insertError || !publication) {
  await admin.storage.from(PUBLIC_BUCKET).remove([glbPublicPath]);
  if (priorActive?.id) {
    await admin.from('publications').update({ is_active: true }).eq('id', priorActive.id);
  }
  console.error('insert_failed', {
    code: insertError?.code,
    message: insertError?.message,
    details: insertError?.details,
    hint: insertError?.hint,
  });
  process.exit(1);
}

await admin
  .from('ar_projects')
  .update({ status: 'published', published_at: new Date().toISOString() })
  .eq('id', projectId);

const viewerUrl = `${PUBLIC_APP}/view/${publicSlug}`;
console.log('publication_id=', publication.id);
console.log('version=', publication.version);
console.log('public_slug=', publicSlug);
console.log('viewer_url=', viewerUrl);
console.log('qr_ok=', viewerUrl.startsWith('https://webar-poc-one.vercel.app/view/'));

const head = await fetch(glbPublicUrl, { method: 'HEAD' });
console.log('public_glb_http=', head.status);

const anon = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: pubAnon } = await anon
  .from('publications')
  .select('public_slug, version, is_active')
  .eq('public_slug', publicSlug)
  .eq('is_active', true)
  .maybeSingle();
console.log('anon_active=', pubAnon);
