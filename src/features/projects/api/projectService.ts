import { isValidSlug, slugify } from '../../../lib/storagePaths';
import { supabase } from '../../../lib/supabaseClient';
import type {
  ArProject,
  ProjectMode,
  SourceMethod,
  WizardStage,
} from '../types';

/**
 * All project reads/writes live here — components never call Supabase
 * directly. Every function requires a configured client and an
 * authenticated session; ownership is never taken from the caller, it
 * comes from auth.uid() via RLS plus the session user id set explicitly on
 * insert (and re-checked by the insert policy).
 */

export class ProjectServiceError extends Error {
  code:
    | 'not-configured'
    | 'not-authenticated'
    | 'not-found'
    | 'conflict'
    | 'request-failed';
  constructor(code: ProjectServiceError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

function requireClient() {
  if (!supabase) {
    throw new ProjectServiceError('not-configured', 'Supabase is not configured.');
  }
  return supabase;
}

async function requireUserId(): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new ProjectServiceError('not-authenticated', 'You are signed out. Sign in again.');
  }
  return data.user.id;
}

/** Map a raw Supabase/PostgREST failure to a safe, user-presentable error. */
function requestFailed(context: string, detail?: string): ProjectServiceError {
  if (import.meta.env.DEV && detail) {
    console.error(`[projects] ${context}:`, detail);
  }
  return new ProjectServiceError('request-failed', `${context}. Please try again.`);
}

export async function listMyProjects(): Promise<ArProject[]> {
  const client = requireClient();
  await requireUserId();
  const { data, error } = await client
    .from('ar_projects')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });
  if (error) throw requestFailed('Loading projects failed', error.message);
  return (data ?? []) as ArProject[];
}

export async function getProject(projectId: string): Promise<ArProject> {
  const client = requireClient();
  await requireUserId();
  const { data, error } = await client
    .from('ar_projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();
  if (error) throw requestFailed('Loading the project failed', error.message);
  if (!data) {
    // RLS returns zero rows both for genuinely missing projects and for
    // projects owned by someone else — deliberately indistinguishable.
    throw new ProjectServiceError('not-found', 'Project not found.');
  }
  return data as ArProject;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  mode: ProjectMode;
}

export async function createProject(input: CreateProjectInput): Promise<ArProject> {
  const client = requireClient();
  const userId = await requireUserId();

  // Slug: derived from the name, uniquified with a random suffix. The DB
  // has a unique constraint as the real guarantee; one retry handles the
  // unlucky collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    const base = slugify(input.name).slice(0, 40);
    const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
    if (!isValidSlug(slug)) {
      throw requestFailed('Creating the project failed');
    }
    const { data, error } = await client
      .from('ar_projects')
      .insert({
        owner_id: userId,
        name: input.name,
        description: input.description || null,
        slug,
        mode: input.mode,
        status: 'draft',
        wizard_stage: 'details',
      })
      .select('*')
      .single();
    if (!error) return data as ArProject;
    const isUniqueViolation = error.code === '23505';
    if (!isUniqueViolation || attempt === 1) {
      throw requestFailed('Creating the project failed', error.message);
    }
  }
  throw requestFailed('Creating the project failed');
}

export interface UpdateProjectInput {
  projectId: string;
  name?: string;
  description?: string | null;
  source_method?: SourceMethod | null;
  wizard_stage?: WizardStage;
}

export async function updateProject(input: UpdateProjectInput): Promise<ArProject> {
  const client = requireClient();
  await requireUserId();
  const { projectId, ...fields } = input;
  const { data, error } = await client
    .from('ar_projects')
    .update(fields)
    .eq('id', projectId)
    .select('*')
    .maybeSingle();
  if (error) throw requestFailed('Saving the project failed', error.message);
  if (!data) throw new ProjectServiceError('not-found', 'Project not found.');
  return data as ArProject;
}

export async function archiveProject(projectId: string): Promise<void> {
  const client = requireClient();
  await requireUserId();
  const { error } = await client
    .from('ar_projects')
    .update({ status: 'archived' })
    .eq('id', projectId);
  if (error) throw requestFailed('Archiving the project failed', error.message);
}

/** Hard delete; cascades to source images, jobs, models, settings via FK. */
export async function deleteProject(projectId: string): Promise<void> {
  const client = requireClient();
  await requireUserId();
  const { error } = await client.from('ar_projects').delete().eq('id', projectId);
  if (error) throw requestFailed('Deleting the project failed', error.message);
}

export interface ProjectCounts {
  total: number;
  draft: number;
  generated: number;
  published: number;
}

export async function countMyProjects(): Promise<ProjectCounts> {
  const projects = await listMyProjects();
  return {
    total: projects.length,
    draft: projects.filter((p) => p.status === 'draft' || p.status === 'uploading').length,
    generated: projects.filter((p) => p.status === 'generated' || p.status === 'ready' || p.status === 'editing').length,
    published: projects.filter((p) => p.status === 'published').length,
  };
}
