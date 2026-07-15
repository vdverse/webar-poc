import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

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
load('.env.validation.local');

const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { data: a, error } = await c.auth.signInWithPassword({
  email: process.env.A_EMAIL,
  password: process.env.A_PASSWORD,
});
if (error) {
  console.log('auth_fail', error.message);
  process.exit(1);
}
const uid = a.user.id;
const { data: p } = await c.from('profiles').select('generation_credits').eq('id', uid).single();
console.log('user=', uid.slice(0, 8) + '…', 'credits=', p?.generation_credits);

const { data: projs } = await c
  .from('ar_projects')
  .select('id,name,source_method,status,wizard_stage')
  .eq('owner_id', uid)
  .eq('source_method', 'single_image')
  .order('updated_at', { ascending: false })
  .limit(5);
console.log('single_image_projects=', (projs || []).length);
for (const pr of projs || []) {
  const { data: imgs } = await c
    .from('project_source_images')
    .select('id,mime_type,width,height,file_size_bytes')
    .eq('project_id', pr.id);
  console.log(
    'project',
    pr.id.slice(0, 8),
    pr.name,
    'status',
    pr.status,
    'imgs',
    (imgs || []).map((i) => ({ mime: i.mime_type, w: i.width, h: i.height, bytes: i.file_size_bytes })),
  );
}
