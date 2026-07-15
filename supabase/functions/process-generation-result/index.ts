/**
 * Trusted completion handler — for webhooks (Batch 3B) or internal retry.
 * Requires service role via shared secret header when invoked without user JWT
 * (webhook path). Authenticated owners may also trigger re-process of their job.
 */

import { isAllowedResultUrl } from '../_shared/generationValidation.ts';
import { ingestCompletedModel } from '../_shared/ingestGeneratedModel.ts';
import { mapSafeError } from '../_shared/safeErrors.ts';
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
    const webhookSecret = Deno.env.get('IMAGE_TO_3D_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');
    const isWebhook = Boolean(webhookSecret && providedSecret === webhookSecret);

    let userId: string | null = null;
    if (!isWebhook) {
      userId = await requireUserId(req.headers.get('Authorization'));
    }

    const body = (await req.json()) as {
      jobId?: string;
      externalJobId?: string;
      modelUrl?: string;
    };

    const service = getServiceClient();
    let jobQuery = service.from('generation_jobs').select('*');
    if (body.jobId) jobQuery = jobQuery.eq('id', body.jobId);
    else if (body.externalJobId) jobQuery = jobQuery.eq('external_job_id', body.externalJobId);
    else {
      return jsonResponse({ error: 'bad-request' }, 400, headers);
    }

    const { data: job, error } = await jobQuery.maybeSingle();
    if (error || !job) {
      return jsonResponse({ error: 'not-found' }, 404, headers);
    }
    if (!isWebhook && job.owner_id !== userId) {
      return jsonResponse({ ...mapSafeError('forbidden') }, 403, headers);
    }

    const modelUrl = body.modelUrl as string | undefined;
    if (!modelUrl || !isAllowedResultUrl(modelUrl)) {
      return jsonResponse({ ...mapSafeError('download-failed') }, 400, headers);
    }

    const ingested = await ingestCompletedModel({
      service,
      job,
      modelUrl,
      providerMetadata: { via: isWebhook ? 'webhook' : 'manual-process' },
    });

    return jsonResponse({ job: ingested.job, model: ingested.model }, 200, headers);
  } catch (e) {
    const code = (e as { code?: string }).code === 'unauthorized' ? 'unauthorized' : 'unknown';
    return jsonResponse({ ...mapSafeError(code) }, code === 'unauthorized' ? 401 : 500, headers);
  }
});
