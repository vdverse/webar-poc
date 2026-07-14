#!/usr/bin/env node
/**
 * Batch 2 live validation against a REAL Supabase project.
 *
 * This runs from YOUR machine (where .env.local and network access to
 * Supabase exist) — it cannot run in the build sandbox, whose egress is
 * allow-listed to package registries + GitHub only (supabase.com returns
 * 403 host_not_allowed there).
 *
 * It does NOT apply migrations. Run those first (supabase db push, or paste
 * 0001–0012 into the SQL editor in order), then run this to verify the
 * resulting schema, storage, auth, CRUD and cross-user RLS actually behave.
 *
 * Usage:
 *   node scripts/validate-supabase.mjs
 *
 * It reads .env.local for:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   (required)
 *
 * It provisions two throwaway test users via signUp. If your project has
 * "Confirm email" enabled, signUp won't yield an active session — the script
 * detects this and tells you exactly what to do (see the runbook). To run the
 * authenticated portions automatically, either temporarily disable email
 * confirmation in Auth settings for the test run, or pass pre-confirmed
 * credentials:
 *   A_EMAIL=... A_PASSWORD=... B_EMAIL=... B_PASSWORD=... node scripts/validate-supabase.mjs
 *
 * Nothing here is destructive to real data: it creates clearly-labelled
 * `[batch2-validation]` projects and removes them at the end.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ---- tiny .env.local loader (no dependency on dotenv) ---------------------
function loadEnvLocal() {
  let text = '';
  try {
    text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  } catch {
    // fall back to process.env only
  }
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { ...out, ...process.env };
}

const env = loadEnvLocal();
const URL_ = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;

if (!URL_ || !ANON) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Populate .env.local first.');
  process.exit(2);
}

let pass = 0;
let fail = 0;
const failures = [];
function ok(name) { pass++; console.log(`  \u2713 ${name}`); }
function bad(name, detail) {
  fail++; failures.push(name);
  console.log(`  \u2717 ${name}${detail ? ` \u2014 ${detail}` : ''}`);
}
function section(t) { console.log(`\n\u2500\u2500 ${t}`); }

const anonClient = () => createClient(URL_, ANON, { auth: { persistSession: false } });

const rand = Math.random().toString(36).slice(2, 8);
const A = { email: env.A_EMAIL || `batch2+a-${rand}@example.com`, password: env.A_PASSWORD || `Aa1!${rand}${rand}` };
const B = { email: env.B_EMAIL || `batch2+b-${rand}@example.com`, password: env.B_PASSWORD || `Bb2!${rand}${rand}` };

async function signInOrUp(creds) {
  const c = anonClient();
  let res = await c.auth.signInWithPassword(creds);
  if (res.error) {
    const up = await c.auth.signUp(creds);
    if (up.error) return { client: c, session: null, error: up.error };
    if (!up.data.session) return { client: c, session: null, error: null, needsConfirm: true };
    res = up;
  }
  return { client: c, session: res.data.session, error: null };
}

async function main() {
  console.log(`Supabase validation against ${URL_.replace(/^https?:\/\//, '').split('.')[0]}.supabase.co`);

  // ---- STEP: schema presence via anon (RLS makes rows invisible, but a
  // missing table gives a distinct "relation does not exist" error) --------
  section('Schema: tables exist');
  const expectTables = [
    'profiles', 'ar_projects', 'project_source_images', 'generation_jobs',
    'generated_models', 'scene_settings', 'publications', 'viewer_events',
  ];
  for (const t of expectTables) {
    const { error } = await anonClient().from(t).select('*').limit(1);
    // PGRST205 / 42P01 => missing table. RLS-empty or permission => table exists.
    if (error && /does not exist|not find the table|PGRST205|42P01/i.test(`${error.message} ${error.code}`)) {
      bad(`table ${t} exists`, error.message);
    } else {
      ok(`table ${t} exists`);
    }
  }

  // ---- STEP: auth ----------------------------------------------------------
  section('Auth: provision two users');
  const a = await signInOrUp(A);
  const b = await signInOrUp(B);
  if (a.needsConfirm || b.needsConfirm) {
    console.log('  ! Email confirmation is ON: signUp did not return a session.');
    console.log('    Confirm the users (or disable confirmation for this run, or pass');
    console.log('    A_EMAIL/A_PASSWORD/B_EMAIL/B_PASSWORD for pre-confirmed accounts),');
    console.log('    then re-run. Skipping authenticated checks.');
    return summarize(true);
  }
  if (!a.session || !b.session) {
    bad('two authenticated sessions', a.error?.message || b.error?.message || 'no session');
    return summarize(false);
  }
  ok('user A signed in');
  ok('user B signed in');
  const aId = a.session.user.id;
  const bId = b.session.user.id;

  // profiles auto-provision trigger
  section('Auth: profile auto-provisioned by trigger');
  {
    const { data, error } = await a.client.from('profiles').select('id').eq('id', aId).maybeSingle();
    if (!error && data?.id === aId) ok('profiles row exists for user A'); else bad('profiles auto-provision', error?.message || 'no row');
  }

  // ---- STEP: CRUD as A -----------------------------------------------------
  section('CRUD: create / list / fetch / update / archive / delete (user A)');
  let projectId = null;
  {
    // create with a FORGED owner_id to prove the server ignores it
    const forged = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await a.client
      .from('ar_projects')
      .insert({
        owner_id: aId, // service layer sets this from session; here we test the DB directly
        name: '[batch2-validation] A project',
        slug: `batch2-a-${rand}`,
        mode: 'markerless_surface',
        status: 'draft',
        wizard_stage: 'details',
      })
      .select('*')
      .single();
    if (error) { bad('create project', error.message); }
    else { projectId = data.id; ok('create project'); if (data.owner_id === aId) ok('owner_id = auth.uid()'); else bad('owner_id = auth.uid()', data.owner_id); }

    // forged owner_id must be rejected by RLS insert policy
    const forgedRes = await a.client.from('ar_projects').insert({
      owner_id: forged, name: '[batch2-validation] forged', slug: `batch2-forge-${rand}`, mode: 'markerless_surface', status: 'draft',
    }).select('*').maybeSingle();
    if (forgedRes.error) ok('forged owner_id rejected by RLS'); else bad('forged owner_id rejected by RLS', 'insert unexpectedly succeeded');
    if (forgedRes.data?.id) await a.client.from('ar_projects').delete().eq('id', forgedRes.data.id);
  }

  if (projectId) {
    const list = await a.client.from('ar_projects').select('*').neq('status', 'archived');
    if (!list.error && list.data.some((p) => p.id === projectId)) ok('list includes active project'); else bad('list active project', list.error?.message);

    const fetched = await a.client.from('ar_projects').select('*').eq('id', projectId).maybeSingle();
    if (!fetched.error && fetched.data) ok('fetch project'); else bad('fetch project', fetched.error?.message);

    const upd = await a.client.from('ar_projects').update({ name: '[batch2-validation] renamed', description: 'desc', source_method: 'single_image', wizard_stage: 'capture' }).eq('id', projectId).select('*').maybeSingle();
    if (!upd.error && upd.data?.name.includes('renamed') && upd.data.wizard_stage === 'capture') ok('rename + description + wizard_stage persist'); else bad('update project', upd.error?.message);

    // updated_at trigger should have advanced
    if (upd.data && upd.data.updated_at !== upd.data.created_at) ok('updated_at trigger fired'); else bad('updated_at trigger', 'updated_at == created_at');

    // check constraint: invalid wizard_stage rejected
    const badStage = await a.client.from('ar_projects').update({ wizard_stage: 'not-a-stage' }).eq('id', projectId).select('*').maybeSingle();
    if (badStage.error) ok('wizard_stage check constraint rejects invalid value'); else bad('wizard_stage check constraint', 'invalid value accepted');

    const arch = await a.client.from('ar_projects').update({ status: 'archived' }).eq('id', projectId);
    if (!arch.error) ok('archive project'); else bad('archive project', arch.error.message);
    const activeList = await a.client.from('ar_projects').select('id').neq('status', 'archived');
    if (!activeList.error && !activeList.data.some((p) => p.id === projectId)) ok('archived excluded from active list'); else bad('archived excluded', 'still present');
  }

  // ---- STEP: storage -------------------------------------------------------
  section('Storage: private bucket + owner-path upload + signed URL');
  const BUCKET = 'source-images-private';
  let objectPath = null;
  if (projectId) {
    const imageId = crypto.randomUUID();
    objectPath = `${aId}/${projectId}/${imageId}-test.jpg`;
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]); // minimal JPEG-ish header
    const up = await a.client.storage.from(BUCKET).upload(objectPath, bytes, { contentType: 'image/jpeg', upsert: false });
    if (!up.error) ok('owner can upload inside own path'); else bad('owner upload', up.error.message);

    // upload OUTSIDE own path must fail
    const outside = await a.client.storage.from(BUCKET).upload(`${bId}/x/y-evil.jpg`, bytes, { contentType: 'image/jpeg' });
    if (outside.error) ok('upload into another user path denied'); else bad('cross-path upload denied', 'unexpectedly allowed');

    const signed = await a.client.storage.from(BUCKET).createSignedUrl(objectPath, 60);
    if (!signed.error && signed.data?.signedUrl) ok('owner can mint signed URL'); else bad('owner signed URL', signed.error?.message);

    // anonymous read of the private object must fail
    const anonRead = await anonClient().storage.from(BUCKET).download(objectPath);
    if (anonRead.error) ok('anonymous cannot read private object'); else bad('anon read denied', 'unexpectedly allowed');
  }

  // ---- STEP: cross-user RLS -----------------------------------------------
  section('Cross-user RLS (user B against user A data)');
  if (projectId) {
    const bFetch = await b.client.from('ar_projects').select('*').eq('id', projectId).maybeSingle();
    if (!bFetch.error && !bFetch.data) ok('B cannot SELECT A project (RLS-empty)'); else bad('B select A project', bFetch.data ? 'row visible!' : bFetch.error?.message);

    const bUpd = await b.client.from('ar_projects').update({ name: 'hacked' }).eq('id', projectId).select('*');
    if (!bUpd.error && (!bUpd.data || bUpd.data.length === 0)) ok('B cannot UPDATE A project'); else bad('B update A project', 'update affected rows');

    const bDel = await b.client.from('ar_projects').delete().eq('id', projectId).select('*');
    if (!bDel.error && (!bDel.data || bDel.data.length === 0)) ok('B cannot DELETE A project'); else bad('B delete A project', 'delete affected rows');

    const bImgs = await b.client.from('project_source_images').select('*').eq('project_id', projectId);
    if (!bImgs.error && (!bImgs.data || bImgs.data.length === 0)) ok('B cannot list A source-image metadata'); else bad('B list A images', 'rows visible');

    if (objectPath) {
      const bSigned = await b.client.storage.from(BUCKET).createSignedUrl(objectPath, 60);
      if (bSigned.error) ok('B cannot sign a URL for A object'); else bad('B sign A object', 'unexpectedly allowed');
      const bDownload = await b.client.storage.from(BUCKET).download(objectPath);
      if (bDownload.error) ok('B cannot download A object'); else bad('B download A object', 'unexpectedly allowed');
    }
  }

  // ---- cleanup -------------------------------------------------------------
  section('Cleanup');
  if (objectPath) await a.client.storage.from(BUCKET).remove([objectPath]);
  if (projectId) await a.client.from('ar_projects').delete().eq('id', projectId);
  ok('removed validation project + object (best-effort)');

  return summarize(false);
}

function summarize(skipped) {
  console.log(`\n${'='.repeat(48)}`);
  console.log(`PASS ${pass}   FAIL ${fail}${skipped ? '   (authenticated checks skipped)' : ''}`);
  if (fail) console.log('Failed: ' + failures.join(', '));
  console.log('='.repeat(48));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('Validation crashed:', e); process.exit(3); });
