/**
 * Validate + publish an already completed Meshy generation.
 * Does NOT call Meshy.
 *
 * Usage: node scripts/validate-and-publish-meshy-model.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
load('.env.batch3b.local');

const PROJECT_ID = '593fea53-623b-44f5-ab25-701501c3d008';
const MODEL_ID = 'f4c1c560-c930-461f-9f90-810686a4c3c7';
const JOB_ID = '67452677-3510-4ca8-81ed-e70eefdb530c';
const PRIVATE_BUCKET = 'generated-models-private';
const PUBLIC_BUCKET = 'published-ar-assets';
const PUBLIC_APP = (process.env.VITE_PUBLIC_APP_URL || 'https://webar-poc-one.vercel.app').replace(
  /\/$/,
  '',
);

/** Inspect GLB using the embedded JSON chunk (no Three.js / browser APIs). */
function inspectGlbBytes(bytes) {
  if (bytes.length < 12) throw new Error('GLB too short');
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'glTF') throw new Error('GLB magic missing');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}`);
  let offset = 12;
  let json = null;
  while (offset + 8 <= bytes.length) {
    const chunkLen = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    const chunk = bytes.subarray(offset, offset + chunkLen);
    offset += chunkLen;
    if (chunkType === 0x4e4f534a) {
      // JSON
      json = JSON.parse(new TextDecoder().decode(chunk));
      break;
    }
  }
  if (!json) throw new Error('GLB JSON chunk missing');

  const meshCount = Array.isArray(json.meshes) ? json.meshes.length : 0;
  if (meshCount < 1) throw new Error('no mesh');

  let triangleCount = 0;
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (prim.indices != null && json.accessors?.[prim.indices]) {
        const acc = json.accessors[prim.indices];
        const mode = prim.mode ?? 4; // TRIANGLES
        if (mode === 4) triangleCount += Math.floor((acc.count || 0) / 3);
      } else if (prim.attributes?.POSITION != null && json.accessors?.[prim.attributes.POSITION]) {
        const acc = json.accessors[prim.attributes.POSITION];
        const mode = prim.mode ?? 4;
        if (mode === 4) triangleCount += Math.floor((acc.count || 0) / 3);
      }
    }
  }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  let haveBounds = false;
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      const pos = prim.attributes?.POSITION;
      if (pos == null) continue;
      const acc = json.accessors?.[pos];
      if (!acc?.min || !acc?.max) continue;
      haveBounds = true;
      minX = Math.min(minX, acc.min[0]);
      minY = Math.min(minY, acc.min[1]);
      minZ = Math.min(minZ, acc.min[2]);
      maxX = Math.max(maxX, acc.max[0]);
      maxY = Math.max(maxY, acc.max[1]);
      maxZ = Math.max(maxZ, acc.max[2]);
    }
  }

  const bounds = haveBounds
    ? {
        width: Number((maxX - minX).toFixed(4)),
        height: Number((maxY - minY).toFixed(4)),
        depth: Number((maxZ - minZ).toFixed(4)),
        min: [Number(minX.toFixed(4)), Number(minY.toFixed(4)), Number(minZ.toFixed(4))],
        max: [Number(maxX.toFixed(4)), Number(maxY.toFixed(4)), Number(maxZ.toFixed(4))],
      }
    : { width: 1, height: 1, depth: 1, min: [0, 0, 0], max: [1, 1, 1] };

  const materialCount = Array.isArray(json.materials) ? json.materials.length : 0;
  const textureCount = Array.isArray(json.textures) ? json.textures.length : 0;
  const animationNames = (json.animations || []).map((a, i) => a.name || `Animation ${i + 1}`);

  return {
    mesh_count: meshCount,
    triangle_count: triangleCount,
    material_count: materialCount,
    texture_count: textureCount,
    animation_names: animationNames,
    bounds,
    warnings: haveBounds ? [] : ['Bounds estimated; POSITION accessors lacked min/max.'],
  };
}

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.BATCH3B_EMAIL;
const password = process.env.BATCH3B_PASSWORD;

if (!url || !anon || !email || !password) {
  console.error('Missing env for validate/publish script.');
  process.exit(1);
}

const supabase = createClient(url, anon, { auth: { persistSession: false } });
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError || !auth.user) {
  console.error('Sign-in failed:', authError?.message);
  process.exit(1);
}
const userId = auth.user.id;
console.log('signed_in_prefix=', userId.slice(0, 8));

const { data: job } = await supabase
  .from('generation_jobs')
  .select('id, status, provider, stage, progress')
  .eq('id', JOB_ID)
  .single();
console.log('job=', job);

const { data: model, error: modelError } = await supabase
  .from('generated_models')
  .select('*')
  .eq('id', MODEL_ID)
  .single();
if (modelError || !model) {
  console.error('model_missing', modelError?.message);
  process.exit(1);
}
console.log('model_path=', model.glb_storage_path);
console.log('model_bytes=', model.file_size_bytes);

const { data: project } = await supabase.from('ar_projects').select('*').eq('id', PROJECT_ID).single();
console.log('project_status=', project?.status);

const { data: blob, error: dlError } = await supabase.storage
  .from(PRIVATE_BUCKET)
  .download(model.glb_storage_path);
if (dlError || !blob) {
  console.error('private_download_failed', dlError?.message);
  process.exit(1);
}
const bytes = new Uint8Array(await blob.arrayBuffer());
console.log('private_download_ok bytes=', bytes.byteLength);

const inspected = inspectGlbBytes(bytes);
console.log('inspected=', JSON.stringify(inspected));

const { error: updateError } = await supabase
  .from('generated_models')
  .update({
    mesh_count: inspected.mesh_count,
    triangle_count: inspected.triangle_count,
    material_count: inspected.material_count,
    texture_count: inspected.texture_count,
    animation_names: inspected.animation_names,
    bounds: inspected.bounds,
    metadata: {
      ...(model.metadata || {}),
      source: 'image_to_3d',
      inspected_at: new Date().toISOString(),
      inspection: 'post_ingest_glb_json',
      warnings: inspected.warnings,
    },
  })
  .eq('id', MODEL_ID);
if (updateError) {
  console.error('metadata_update_failed', updateError.message);
  process.exit(1);
}
console.log('metadata_updated=true');

const settingsRow = {
  project_id: PROJECT_ID,
  owner_id: userId,
  model_id: MODEL_ID,
  scale: 1,
  rotation_x: 0,
  rotation_y: 0,
  rotation_z: 0,
  placement_mode: 'floor',
  shadow_intensity: 1,
  auto_rotate: true,
  camera_controls: true,
  animation_name: null,
  animation_autoplay: false,
  animation_loop: true,
  viewer_config: {
    arScaleMode: 'auto',
    physicalHeight: 0.3,
  },
};
const { data: settings, error: settingsError } = await supabase
  .from('scene_settings')
  .upsert(settingsRow, { onConflict: 'project_id' })
  .select('*')
  .single();
if (settingsError || !settings) {
  console.error('scene_settings_failed', settingsError?.message);
  process.exit(1);
}
console.log('scene_settings_saved=true');

function slugify(name) {
  return String(name || 'ar')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

const { data: prior } = await supabase
  .from('publications')
  .select('version, public_slug, is_active')
  .eq('project_id', PROJECT_ID)
  .order('version', { ascending: false })
  .limit(5);
const nextVersion = (prior?.[0]?.version ?? 0) + 1;
const existingActive = (prior || []).find((p) => p.is_active);
const publicSlug =
  existingActive?.public_slug ||
  `${slugify(project.name)}-${PROJECT_ID.replace(/-/g, '').slice(0, 8)}`;
const glbPublicPath = `${PROJECT_ID}/${nextVersion}/model.glb`;

const { error: pubUpError } = await supabase.storage.from(PUBLIC_BUCKET).upload(glbPublicPath, bytes, {
  contentType: 'model/gltf-binary',
  upsert: true,
});
if (pubUpError) {
  console.error('public_upload_failed', pubUpError.message);
  process.exit(1);
}
console.log('public_upload_ok path=', glbPublicPath);

const glbPublicUrl = `${url.replace(/\/$/, '')}/storage/v1/object/public/${PUBLIC_BUCKET}/${glbPublicPath}`;
const h = inspected.bounds.height > 0 ? inspected.bounds.height : 1;
const effectiveScale = Number(((0.3 / h) * settings.scale).toFixed(6));

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
    physicalWidth: Number((inspected.bounds.width * (0.3 / h)).toFixed(4)),
    physicalHeight: 0.3,
    physicalDepth: Number((inspected.bounds.depth * (0.3 / h)).toFixed(4)),
    physicalSizeEstimated: false,
    effectiveScale,
    arScaleMode: 'auto',
  },
  modelBounds: inspected.bounds,
  floorAlignmentNotes: [],
  arModes: 'webxr scene-viewer',
  publishedAt: new Date().toISOString(),
};

await supabase.from('publications').update({ is_active: false }).eq('project_id', PROJECT_ID).eq('is_active', true);

const { data: publication, error: pubInsError } = await supabase
  .from('publications')
  .insert({
    project_id: PROJECT_ID,
    owner_id: userId,
    public_slug: publicSlug,
    version: nextVersion,
    snapshot,
    is_active: true,
  })
  .select('*')
  .single();
if (pubInsError || !publication) {
  console.error('publication_insert_failed', pubInsError?.message);
  process.exit(1);
}

await supabase
  .from('ar_projects')
  .update({ status: 'published', published_at: new Date().toISOString() })
  .eq('id', PROJECT_ID);

const viewerUrl = `${PUBLIC_APP}/view/${publicSlug}`;
console.log('publication_id=', publication.id);
console.log('public_slug=', publicSlug);
console.log('viewer_url=', viewerUrl);
console.log('qr_target_ok=', viewerUrl.startsWith(`${PUBLIC_APP}/view/`));
console.log('viewer_not_storage=', !viewerUrl.includes('/storage/'));

const anonClient = createClient(url, anon, { auth: { persistSession: false } });
const { data: pubAnon, error: anonErr } = await anonClient
  .from('publications')
  .select('public_slug, is_active, snapshot')
  .eq('public_slug', publicSlug)
  .eq('is_active', true)
  .maybeSingle();
if (anonErr || !pubAnon) {
  console.error('anon_publication_failed', anonErr?.message);
  process.exit(1);
}
const snapUrl = pubAnon.snapshot?.glbPublicUrl || '';
console.log('anon_publication_ok=true');
console.log('anon_has_signed_token=', /[?&]token=|X-Amz-|Signature=/i.test(snapUrl));
console.log('anon_public_object=', snapUrl.includes('/object/public/published-ar-assets/'));

const head = await fetch(snapUrl, { method: 'HEAD' });
console.log('public_glb_http=', head.status, 'content_type=', head.headers.get('content-type'));

const get = await fetch(snapUrl, { method: 'GET', headers: { Range: 'bytes=0-3' } });
const sample = new Uint8Array(await get.arrayBuffer());
console.log(
  'public_glb_magic=',
  sample.length >= 4 &&
    sample[0] === 0x67 &&
    sample[1] === 0x6c &&
    sample[2] === 0x54 &&
    sample[3] === 0x46,
);

writeFileSync(
  resolve('.batch3b-publish-result.json'),
  JSON.stringify(
    {
      projectId: PROJECT_ID,
      modelId: MODEL_ID,
      jobId: JOB_ID,
      publicationId: publication.id,
      publicSlug,
      viewerUrl,
      meta: inspected,
      fileSizeBytes: bytes.byteLength,
    },
    null,
    2,
  ) + '\n',
);
console.log('Wrote .batch3b-publish-result.json');
