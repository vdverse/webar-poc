import { sha256Hex, validateImageCounts, MESHY_MULTI_MAX_IMAGES } from '../_shared/generationValidation.ts';
import { getImageTo3DProvider } from '../_shared/providers/providerFactory.ts';
import { ProviderError } from '../_shared/providers/types.ts';
import { mapSafeError } from '../_shared/safeErrors.ts';
import { bytesToDataUri } from '../_shared/sourceImageDataUri.ts';
import {
  corsHeaders,
  getServiceClient,
  jsonResponse,
  requireUserId,
} from '../_shared/supabase.ts';

const SOURCE_BUCKET = 'source-images-private';

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
    const body = (await req.json()) as { projectId?: string };
    if (!body.projectId || typeof body.projectId !== 'string') {
      return jsonResponse({ error: 'bad-request', message: 'projectId is required.' }, 400, headers);
    }

    const service = getServiceClient();

    const { data: project, error: projectError } = await service
      .from('ar_projects')
      .select('id, owner_id, source_method, status')
      .eq('id', body.projectId)
      .maybeSingle();

    if (projectError || !project) {
      return jsonResponse({ error: 'not-found', message: 'Project not found.' }, 404, headers);
    }
    if (project.owner_id !== userId) {
      return jsonResponse({ ...mapSafeError('forbidden') }, 403, headers);
    }
    if (project.source_method !== 'single_image' && project.source_method !== 'multi_view') {
      return jsonResponse({ ...mapSafeError('bad-source-method') }, 400, headers);
    }

    const { data: images, error: imagesError } = await service
      .from('project_source_images')
      .select('id, storage_path, sort_order, mime_type')
      .eq('project_id', body.projectId)
      .order('sort_order', { ascending: true });

    if (imagesError) {
      return jsonResponse({ ...mapSafeError('database-failed') }, 500, headers);
    }
    const countError = validateImageCounts(project.source_method, images?.length ?? 0);
    if (countError) {
      return jsonResponse({ ...mapSafeError(countError) }, 400, headers);
    }

    // Meshy multi-image API hard-caps at 4 images (official docs).
    if (
      project.source_method === 'multi_view' &&
      (images?.length ?? 0) > MESHY_MULTI_MAX_IMAGES
    ) {
      return jsonResponse(
        {
          ...mapSafeError('invalid-images'),
          message: `Meshy accepts at most ${MESHY_MULTI_MAX_IMAGES} photos for multi-image generation.`,
        },
        400,
        headers,
      );
    }

    const { data: active } = await service
      .from('generation_jobs')
      .select('id, status, stage, progress, provider, created_at')
      .eq('project_id', body.projectId)
      .in('status', ['queued', 'uploading', 'submitted', 'processing'])
      .maybeSingle();

    if (active) {
      return jsonResponse(
        {
          ...mapSafeError('duplicate-active-job'),
          job: active,
        },
        409,
        headers,
      );
    }

    const { data: profile } = await service
      .from('profiles')
      .select('generation_credits')
      .eq('id', userId)
      .maybeSingle();

    const credits = profile?.generation_credits ?? 0;
    if (credits <= 0) {
      return jsonResponse({ ...mapSafeError('entitlement-exhausted') }, 403, headers);
    }

    const requestHash = await sha256Hex(
      `${body.projectId}|${project.source_method}|${(images ?? []).map((i) => i.id).sort().join(',')}`,
    );

    let provider;
    try {
      provider = getImageTo3DProvider();
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'provider-not-configured';
      return jsonResponse({ ...mapSafeError(code) }, 503, headers);
    }

    // Prefer data URIs for smaller files (Meshy docs allow them). Larger images
    // use short-lived signed HTTPS URLs Meshy can fetch from the public internet.
    const DATA_URI_MAX_BYTES = 3.5 * 1024 * 1024;
    const imageUrls: string[] = [];
    try {
      for (const img of images ?? []) {
        const mime = (img.mime_type ?? '').toLowerCase();
        if (mime !== 'image/jpeg' && mime !== 'image/png') {
          return jsonResponse(
            {
              ...mapSafeError('invalid-images'),
              message: 'Meshy accepts JPEG and PNG only. Re-upload without WebP.',
            },
            400,
            headers,
          );
        }
        const { data: blob, error: dlError } = await service.storage
          .from(SOURCE_BUCKET)
          .download(img.storage_path);
        if (dlError || !blob) {
          return jsonResponse({ ...mapSafeError('invalid-images') }, 400, headers);
        }
        const size = blob.size;
        if (size <= DATA_URI_MAX_BYTES) {
          const buf = new Uint8Array(await blob.arrayBuffer());
          imageUrls.push(bytesToDataUri(mime, buf));
        } else {
          const { data: signed, error: signError } = await service.storage
            .from(SOURCE_BUCKET)
            .createSignedUrl(img.storage_path, 15 * 60);
          if (signError || !signed?.signedUrl) {
            return jsonResponse({ ...mapSafeError('invalid-images') }, 400, headers);
          }
          imageUrls.push(signed.signedUrl);
        }
      }
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'invalid-images';
      return jsonResponse({ ...mapSafeError(code) }, 400, headers);
    }

    const { data: job, error: insertError } = await service
      .from('generation_jobs')
      .insert({
        project_id: body.projectId,
        owner_id: userId,
        provider: provider.name,
        input_mode: project.source_method,
        status: 'queued',
        stage: 'Preparing images',
        progress: 0,
        attempts: 1,
        request_hash: requestHash,
        request_payload: {
          image_count: imageUrls.length,
          input_mode: project.source_method,
          delivery: 'data_uri',
        },
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insertError || !job) {
      console.error('[create-generation-job] insert', insertError?.message);
      return jsonResponse({ ...mapSafeError('database-failed') }, 500, headers);
    }

    try {
      const created = await provider.createJob({
        projectId: body.projectId,
        ownerId: userId,
        inputMode: project.source_method,
        imageUrls,
      });

      const { data: updated, error: updateError } = await service
        .from('generation_jobs')
        .update({
          external_job_id: created.externalJobId,
          status: created.status === 'queued' ? 'queued' : 'submitted',
          stage: 'Submitting generation',
          progress: 5,
        })
        .eq('id', job.id)
        .select('*')
        .single();

      if (updateError) {
        return jsonResponse({ ...mapSafeError('database-failed') }, 500, headers);
      }

      // Credit consumed only after Meshy accepts the job (not on duplicate 409).
      await service
        .from('profiles')
        .update({ generation_credits: Math.max(0, credits - 1) })
        .eq('id', userId)
        .eq('generation_credits', credits);

      await service
        .from('ar_projects')
        .update({ status: 'generating' })
        .eq('id', body.projectId);

      return jsonResponse(
        {
          job: {
            id: updated!.id,
            project_id: updated!.project_id,
            status: updated!.status,
            stage: updated!.stage,
            progress: updated!.progress,
            provider: updated!.provider,
            input_mode: updated!.input_mode,
            created_at: updated!.created_at,
          },
        },
        201,
        headers,
      );
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'provider-submit-failed';
      const safe = mapSafeError(code);
      await service
        .from('generation_jobs')
        .update({
          status: 'failed',
          stage: 'Failed',
          safe_error_code: safe.safe_error_code,
          safe_error_message: safe.safe_error_message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      return jsonResponse({ ...safe, jobId: job.id }, 502, headers);
    }
  } catch (e) {
    const code = (e as { code?: string }).code === 'unauthorized' ? 'unauthorized' : 'unknown';
    return jsonResponse({ ...mapSafeError(code) }, code === 'unauthorized' ? 401 : 500, headers);
  }
});
