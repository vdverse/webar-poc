/**
 * Live Batch 3B helper: create or reuse a single_image project, ensure one JPEG,
 * call create-generation-job once, poll get-generation-status until terminal.
 *
 * Requires:
 *   .env.local          VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *   .env.validation.local  A_EMAIL, A_PASSWORD
 *
 * Does not print secrets. Costs one Meshy-generation credit when the job is accepted.
 *
 * Usage: node scripts/live-meshy-generate.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnvFile(resolve('.env.local'));
loadEnvFile(resolve('.env.validation.local'));
loadEnvFile(resolve('.env.batch3b.local'));

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.BATCH3B_EMAIL || process.env.A_EMAIL;
const password = process.env.BATCH3B_PASSWORD || process.env.A_PASSWORD;
const forcedProjectId = process.env.BATCH3B_PROJECT_ID;

if (!url || !anon || !email || !password) {
  console.error('Missing VITE_SUPABASE_* or A_EMAIL/A_PASSWORD.');
  process.exit(1);
}

const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (authError || !auth.user) {
  console.error('Sign-in failed.');
  process.exit(1);
}
const userId = auth.user.id;
const token = auth.session.access_token;

const { data: profile } = await supabase
  .from('profiles')
  .select('generation_credits')
  .eq('id', userId)
  .single();
console.log('credits_before=', profile?.generation_credits);

if ((profile?.generation_credits ?? 0) < 1) {
  console.error('No generation credits. Top up profiles.generation_credits then retry.');
  process.exit(1);
}

let project = null;
let imageCount = 0;

if (forcedProjectId) {
  const { data: p } = await supabase
    .from('ar_projects')
    .select('id, name, source_method, wizard_stage, status')
    .eq('id', forcedProjectId)
    .maybeSingle();
  project = p;
  const { data: imgs } = await supabase
    .from('project_source_images')
    .select('id')
    .eq('project_id', forcedProjectId);
  imageCount = imgs?.length ?? 0;
} else {
  const { data: projects } = await supabase
    .from('ar_projects')
    .select('id, name, source_method, wizard_stage, status')
    .eq('owner_id', userId)
    .eq('source_method', 'single_image')
    .order('updated_at', { ascending: false })
    .limit(20);

  for (const p of projects ?? []) {
    const { data: imgs } = await supabase
      .from('project_source_images')
      .select('id, mime_type')
      .eq('project_id', p.id);
    const usable = (imgs ?? []).filter((i) =>
      ['image/jpeg', 'image/png'].includes((i.mime_type ?? '').toLowerCase()),
    );
    if (usable.length >= 1) {
      project = p;
      imageCount = usable.length;
      break;
    }
  }
}

if (!project) {
  console.error(
    'No single_image project with JPEG/PNG source image found. Create one in the UI first.',
  );
  process.exit(1);
}

console.log('project_id=', project.id, 'name=', project.name, 'images=', imageCount);

// Ensure no active job
const { data: active } = await supabase
  .from('generation_jobs')
  .select('id, status')
  .eq('project_id', project.id)
  .in('status', ['queued', 'uploading', 'submitted', 'processing'])
  .maybeSingle();
if (active) {
  console.log('active_job_already=', active.id, active.status);
  console.log('Will poll existing job instead of creating a new (paid) one.');
}

async function invoke(name, body) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

let jobId = active?.id;
if (!jobId) {
  console.log('Submitting create-generation-job (one Meshy charge if accepted)…');
  const created = await invoke('create-generation-job', { projectId: project.id });
  console.log('create_http=', created.status);
  if (created.status !== 201) {
    console.log('create_body=', JSON.stringify(created.json, null, 2));
    process.exit(1);
  }
  jobId = created.json.job.id;
  console.log('job_id=', jobId);
  console.log('external_hint_stored=yes (see DB; not printed here if sensitive)');
}

const started = Date.now();
let lastStatus = '';
for (;;) {
  const polled = await invoke('get-generation-status', { jobId });
  const job = polled.json.job;
  if (!job) {
    console.log('poll_error=', polled.status, JSON.stringify(polled.json));
    process.exit(1);
  }
  const line = `${job.status} stage=${job.stage} progress=${job.progress}`;
  if (line !== lastStatus) {
    console.log(line);
    lastStatus = line;
  }
  if (['completed', 'failed', 'cancelled', 'expired'].includes(job.status)) {
    console.log('terminal=', job.status);
    if (job.safe_error_code) console.log('safe_error=', job.safe_error_code, job.safe_error_message);
    if (polled.json.model) {
      console.log(
        'model_id=',
        polled.json.model.id,
        'bytes=',
        polled.json.model.file_size_bytes,
        'path_prefix=',
        String(polled.json.model.glb_storage_path ?? '').split('/').slice(0, 2).join('/'),
      );
    }
    break;
  }
  if (Date.now() - started > 20 * 60 * 1000) {
    console.error('Timed out after 20 minutes.');
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 5000));
}

const { data: profileAfter } = await supabase
  .from('profiles')
  .select('generation_credits')
  .eq('id', userId)
  .single();
console.log('credits_after=', profileAfter?.generation_credits);
console.log('duration_ms=', Date.now() - started);

const { data: jobRow } = await supabase
  .from('generation_jobs')
  .select('id, status, external_job_id, provider, progress, stage, result_metadata')
  .eq('id', jobId)
  .single();
console.log(
  'job_summary=',
  JSON.stringify({
    id: jobRow?.id,
    status: jobRow?.status,
    provider: jobRow?.provider,
    external_job_id_redacted: jobRow?.external_job_id
      ? `${String(jobRow.external_job_id).slice(0, 8)}…`
      : null,
    stage: jobRow?.stage,
    progress: jobRow?.progress,
    result_bytes: jobRow?.result_metadata?.file_size_bytes ?? null,
  }),
);
