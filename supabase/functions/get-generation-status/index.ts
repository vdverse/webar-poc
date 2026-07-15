import {
  glbMagicOk,
  isAllowedResultUrl,
  MAX_RESULT_BYTES,
} from '../_shared/generationValidation.ts';
import { getImageTo3DProvider } from '../_shared/providers/providerFactory.ts';
import { ProviderError } from '../_shared/providers/types.ts';
import { mapSafeError } from '../_shared/safeErrors.ts';
import {
  corsHeaders,
  getServiceClient,
  jsonResponse,
  requireUserId,
} from '../_shared/supabase.ts';
import { ingestCompletedModel } from '../_shared/ingestGeneratedModel.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const headers = corsHeaders(origin);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method-not-allowed' }, 405, headers);
  }

  try {
    const userId = await requireUserId(req.headers.get('Authorization'));
    const body = (await req.json()) as { jobId?: string; projectId?: string };
    const service = getServiceClient();

    let query = service.from('generation_jobs').select('*');
    if (body.jobId) query = query.eq('id', body.jobId);
    else if (body.projectId) {
      query = query.eq('project_id', body.projectId).order('created_at', { ascending: false }).limit(1);
    } else {
      return jsonResponse({ error: 'bad-request', message: 'jobId or projectId required.' }, 400, headers);
    }

    const { data: job, error } = await query.maybeSingle();
    if (error || !job) {
      return jsonResponse({ error: 'not-found', message: 'Generation job not found.' }, 404, headers);
    }
    if (job.owner_id !== userId) {
      return jsonResponse({ ...mapSafeError('forbidden') }, 403, headers);
    }

    const terminal = ['completed', 'failed', 'cancelled', 'expired'].includes(job.status);
    if (terminal || !job.external_job_id) {
      return jsonResponse({ job: sanitizeJob(job) }, 200, headers);
    }

    let providerStatus;
    try {
      const provider = getImageTo3DProvider();
      providerStatus = await provider.getJobStatus(job.external_job_id);
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'provider-status-failed';
      return jsonResponse({ ...mapSafeError(code), job: sanitizeJob(job) }, 200, headers);
    }

    if (providerStatus.status === 'completed' && providerStatus.modelUrl) {
      if (!isAllowedResultUrl(providerStatus.modelUrl)) {
        const safe = mapSafeError('download-failed');
        const { data: failed } = await service
          .from('generation_jobs')
          .update({
            status: 'failed',
            stage: 'Failed',
            ...safe,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id)
          .select('*')
          .single();
        return jsonResponse({ job: sanitizeJob(failed ?? job), ...safe }, 200, headers);
      }

      try {
        const ingested = await ingestCompletedModel({
          service,
          job,
          modelUrl: providerStatus.modelUrl,
          providerMetadata: providerStatus.metadata ?? {},
        });
        return jsonResponse({ job: sanitizeJob(ingested.job), model: ingested.model }, 200, headers);
      } catch (e) {
        const code =
          e instanceof Error && (e.message.includes('magic') || e.message.includes('GLB'))
            ? 'invalid-glb'
            : 'download-failed';
        const safe = mapSafeError(code);
        const { data: failed } = await service
          .from('generation_jobs')
          .update({
            status: 'failed',
            stage: 'Failed',
            ...safe,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id)
          .select('*')
          .single();
        return jsonResponse({ job: sanitizeJob(failed ?? job), ...safe }, 200, headers);
      }
    }

    if (providerStatus.status === 'failed' || providerStatus.status === 'cancelled') {
      const safe = mapSafeError(
        providerStatus.status === 'cancelled' ? 'cancelled' : 'provider-generation-failed',
      );
      const { data: updated } = await service
        .from('generation_jobs')
        .update({
          status: providerStatus.status === 'cancelled' ? 'cancelled' : 'failed',
          stage: providerStatus.stage ?? (providerStatus.status === 'cancelled' ? 'Cancelled' : 'Failed'),
          ...safe,
          cancelled_at:
            providerStatus.status === 'cancelled' ? new Date().toISOString() : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .select('*')
        .single();
      return jsonResponse({ job: sanitizeJob(updated ?? job) }, 200, headers);
    }

    const progress =
      typeof providerStatus.progress === 'number' ? providerStatus.progress : job.progress;
    const { data: updated } = await service
      .from('generation_jobs')
      .update({
        status: providerStatus.status === 'queued' ? 'queued' : 'processing',
        stage: providerStatus.stage ?? 'Processing',
        progress: Math.min(100, Math.max(0, progress)),
      })
      .eq('id', job.id)
      .select('*')
      .single();

    return jsonResponse({ job: sanitizeJob(updated ?? job) }, 200, headers);
  } catch (e) {
    const code = (e as { code?: string }).code === 'unauthorized' ? 'unauthorized' : 'unknown';
    return jsonResponse({ ...mapSafeError(code) }, code === 'unauthorized' ? 401 : 500, headers);
  }
});

function sanitizeJob(job: Record<string, unknown>) {
  return {
    id: job.id,
    project_id: job.project_id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    provider: job.provider,
    input_mode: job.input_mode,
    safe_error_code: job.safe_error_code,
    safe_error_message: job.safe_error_message,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    cancelled_at: job.cancelled_at,
  };
}

void glbMagicOk;
void MAX_RESULT_BYTES;
