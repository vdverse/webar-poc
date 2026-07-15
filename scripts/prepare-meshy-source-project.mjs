/**
 * Prepares a single_image project + JPEG for live Meshy generation.
 * Uses service_role from CLI without printing key values.
 * Writes sign-in credentials to .env.batch3b.local (gitignored).
 *
 * Usage: node scripts/prepare-meshy-source-project.mjs [userId]
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

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

const url = process.env.VITE_SUPABASE_URL;
if (!url) {
  console.error('VITE_SUPABASE_URL missing');
  process.exit(1);
}

const json = execSync('supabase projects api-keys --project-ref codqgrxradxaloruoyys -o json', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const parsed = JSON.parse(json);
const row = (parsed || []).find((k) => k.name === 'service_role');
const serviceKey = row?.api_key || row?.key || row?.value || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error('Could not resolve service_role key from CLI.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const userId = process.argv[2] || '063cfc87-8f71-43d4-973d-a986eb3b4593';

const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
if (userError || !userData.user?.email) {
  console.error('user_lookup_failed');
  process.exit(1);
}
const email = userData.user.email;

const { data: before } = await admin.from('profiles').select('generation_credits').eq('id', userId).single();
console.log('credits_before=', before?.generation_credits);
await admin
  .from('profiles')
  .update({ generation_credits: Math.max(3, before?.generation_credits ?? 0) })
  .eq('id', userId);
const { data: after } = await admin.from('profiles').select('generation_credits').eq('id', userId).single();
console.log('credits_after=', after?.generation_credits);

const projectId = randomUUID();
const slug = `meshy-batch3b-${projectId.slice(0, 8)}`;
const { error: projectError } = await admin.from('ar_projects').insert({
  id: projectId,
  owner_id: userId,
  name: 'Batch 3B Meshy test',
  description: 'Single-image generation test for Meshy → GLB → studio',
  slug,
  mode: 'markerless_surface',
  status: 'draft',
  source_method: 'single_image',
  wizard_stage: 'saved',
});
if (projectError) {
  console.error('project_insert_failed', projectError.message);
  process.exit(1);
}
console.log('project_id=', projectId);

// Public domain JPEG (flower) — known MIME image/jpeg, suitable object-ish subject.
const jpegRes = await fetch(
  'https://upload.wikimedia.org/wikipedia/commons/3/3f/JPEG_example_flower.jpg',
);
if (!jpegRes.ok) {
  console.error('sample_download_failed', jpegRes.status);
  process.exit(1);
}
const bytes = new Uint8Array(await jpegRes.arrayBuffer());
const mime = 'image/jpeg';
const imageId = randomUUID();
const filename = 'source.jpg';
const storagePath = `${userId}/${projectId}/${imageId}-${filename}`;
const { error: upError } = await admin.storage.from('source-images-private').upload(storagePath, bytes, {
  contentType: mime,
  upsert: false,
});
if (upError) {
  console.error('upload_failed', upError.message);
  process.exit(1);
}

const { error: rowError } = await admin.from('project_source_images').insert({
  id: imageId,
  project_id: projectId,
  owner_id: userId,
  storage_path: storagePath,
  original_filename: filename,
  mime_type: mime,
  file_size_bytes: bytes.byteLength,
  width: 0,
  height: 0,
  angle_label: 'front',
  sort_order: 0,
});
if (rowError) {
  console.error('image_row_failed', rowError.message);
  process.exit(1);
}

console.log('image_id=', imageId, 'mime=', mime, 'bytes=', bytes.byteLength);

const tempPassword = `Batch3b-${randomUUID().slice(0, 8)}!Aa1`;
const { error: pwError } = await admin.auth.admin.updateUserById(userId, {
  password: tempPassword,
});
if (pwError) {
  console.error('password_reset_failed', pwError.message);
  process.exit(1);
}

writeFileSync(
  resolve('.env.batch3b.local'),
  [
    `BATCH3B_EMAIL=${email}`,
    `BATCH3B_USER_ID=${userId}`,
    `BATCH3B_PASSWORD=${tempPassword}`,
    `BATCH3B_PROJECT_ID=${projectId}`,
  ].join('\n') + '\n',
  { encoding: 'utf8' },
);
console.log('Wrote .env.batch3b.local (gitignored). Password not printed.');
