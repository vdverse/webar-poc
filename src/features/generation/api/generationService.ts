import { ProjectServiceError } from '../../projects/api/projectService';
import { supabase } from '../../../lib/supabaseClient';
import type { GenerationJob } from '../types';

function requireClient() {
  if (!supabase) {
    throw new ProjectServiceError('not-configured', 'Supabase is not configured.');
  }
  return supabase;
}

async function authHeaders(): Promise<Record<string, string>> {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new ProjectServiceError('not-authenticated', 'You are signed out. Sign in again.');
  }
  return {
    Authorization: `Bearer ${data.session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    'Content-Type': 'application/json',
  };
}

function functionsBase(): string {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  if (!url) throw new ProjectServiceError('not-configured', 'Supabase is not configured.');
  return `${url}/functions/v1`;
}

export class GenerationServiceError extends Error {
  code: string;
  job?: GenerationJob;
  constructor(code: string, message: string, job?: GenerationJob) {
    super(message);
    this.code = code;
    this.job = job;
  }
}

async function invoke<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  let res: Response;
  try {
    res = await fetch(`${functionsBase()}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new GenerationServiceError('offline', 'Network error. Check your connection.');
  }

  const payload = (await res.json().catch(() => ({}))) as {
    job?: GenerationJob;
    model?: unknown;
    safe_error_code?: string;
    safe_error_message?: string;
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    const code = payload.safe_error_code ?? payload.error ?? 'unknown';
    const message =
      payload.safe_error_message ??
      payload.message ??
      'Generation request failed. Please try again.';
    throw new GenerationServiceError(code, message, payload.job);
  }

  return payload as T;
}

export async function createGenerationJob(projectId: string): Promise<GenerationJob> {
  const result = await invoke<{ job: GenerationJob }>('create-generation-job', { projectId });
  return result.job;
}

export async function getGenerationStatus(input: {
  jobId?: string;
  projectId?: string;
}): Promise<{ job: GenerationJob; model?: unknown }> {
  return invoke('get-generation-status', input);
}

export async function cancelGenerationJob(jobId: string): Promise<GenerationJob> {
  const result = await invoke<{ job: GenerationJob }>('cancel-generation-job', { jobId });
  return result.job;
}

/** Read latest job from DB (survives refresh without calling provider). */
export async function getLatestJobForProject(projectId: string): Promise<GenerationJob | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('generation_jobs')
    .select(
      'id, project_id, status, stage, progress, provider, input_mode, safe_error_code, safe_error_message, created_at, started_at, completed_at, cancelled_at',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new ProjectServiceError('request-failed', 'Could not load generation status.');
  }
  return (data as GenerationJob | null) ?? null;
}
