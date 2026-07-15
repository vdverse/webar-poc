import { mapSafeError } from '../_shared/safeErrors.ts';
import { getImageTo3DProvider } from '../_shared/providers/providerFactory.ts';
import {
  corsHeaders,
  getServiceClient,
  jsonResponse,
  requireUserId,
} from '../_shared/supabase.ts';

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
    const body = (await req.json()) as { jobId?: string };
    if (!body.jobId) {
      return jsonResponse({ error: 'bad-request', message: 'jobId is required.' }, 400, headers);
    }

    const service = getServiceClient();
    const { data: job, error } = await service
      .from('generation_jobs')
      .select('*')
      .eq('id', body.jobId)
      .maybeSingle();

    if (error || !job) {
      return jsonResponse({ error: 'not-found' }, 404, headers);
    }
    if (job.owner_id !== userId) {
      return jsonResponse({ ...mapSafeError('forbidden') }, 403, headers);
    }

    if (['completed', 'failed', 'cancelled', 'expired'].includes(job.status)) {
      return jsonResponse({ job: { id: job.id, status: job.status } }, 200, headers);
    }

    if (job.external_job_id) {
      try {
        const provider = getImageTo3DProvider();
        await provider.cancelJob?.(job.external_job_id);
      } catch {
        // Best-effort cancel at provider; still mark locally cancelled.
      }
    }

    const safe = mapSafeError('cancelled');
    const { data: updated } = await service
      .from('generation_jobs')
      .update({
        status: 'cancelled',
        stage: 'Cancelled',
        cancelled_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        ...safe,
      })
      .eq('id', job.id)
      .select('id, status, stage, cancelled_at')
      .single();

    return jsonResponse({ job: updated }, 200, headers);
  } catch (e) {
    const code = (e as { code?: string }).code === 'unauthorized' ? 'unauthorized' : 'unknown';
    return jsonResponse({ ...mapSafeError(code) }, code === 'unauthorized' ? 401 : 500, headers);
  }
});
