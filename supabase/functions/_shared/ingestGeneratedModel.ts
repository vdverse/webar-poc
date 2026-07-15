import {
  glbMagicOk,
  isAllowedResultUrl,
  MAX_RESULT_BYTES,
} from './generationValidation.ts';
import { inspectGlbJsonChunk } from './glbJsonInspect.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const MODEL_BUCKET = 'generated-models-private';

export async function ingestCompletedModel(input: {
  service: SupabaseClient;
  job: {
    id: string;
    project_id: string;
    owner_id: string;
    status: string;
  };
  modelUrl: string;
  providerMetadata: Record<string, unknown>;
}): Promise<{ job: Record<string, unknown>; model: Record<string, unknown> }> {
  // Idempotent: if a model already exists for this job, return it.
  {
    const { data: existing } = await input.service
      .from('generated_models')
      .select('*')
      .eq('generation_job_id', input.job.id)
      .maybeSingle();
    if (existing) {
      const { data: jobRow } = await input.service
        .from('generation_jobs')
        .select('*')
        .eq('id', input.job.id)
        .single();
      if (jobRow?.status !== 'completed') {
        await input.service
          .from('generation_jobs')
          .update({
            status: 'completed',
            stage: 'Complete',
            progress: 100,
            completed_at: new Date().toISOString(),
          })
          .eq('id', input.job.id);
      }
      const { data: freshJob } = await input.service
        .from('generation_jobs')
        .select('*')
        .eq('id', input.job.id)
        .single();
      return { job: freshJob ?? jobRow!, model: existing };
    }
  }

  if (!isAllowedResultUrl(input.modelUrl)) {
    throw new Error('Result URL host is not allow-listed.');
  }

  await input.service
    .from('generation_jobs')
    .update({ stage: 'Downloading result', progress: 90 })
    .eq('id', input.job.id);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let bytes: Uint8Array;
  try {
    const res = await fetch(input.modelUrl, {
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error('Download HTTP failed');
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_RESULT_BYTES) throw new Error('GLB too large');
    if (!glbMagicOk(buf)) throw new Error('GLB magic missing');
    bytes = buf;
  } finally {
    clearTimeout(timeout);
  }

  await input.service
    .from('generation_jobs')
    .update({ stage: 'Validating GLB', progress: 95 })
    .eq('id', input.job.id);

  let inspection;
  try {
    inspection = inspectGlbJsonChunk(bytes);
  } catch (e) {
    throw new Error(`GLB inspect failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }

  const modelId = crypto.randomUUID();
  const path = `${input.job.owner_id}/${input.job.project_id}/${modelId}.glb`;

  const { error: uploadError } = await input.service.storage
    .from(MODEL_BUCKET)
    .upload(path, bytes, {
      contentType: 'model/gltf-binary',
      upsert: false,
    });
  if (uploadError) throw new Error(`upload failed: ${uploadError.message}`);

  const { data: model, error: insertError } = await input.service
    .from('generated_models')
    .insert({
      id: modelId,
      project_id: input.job.project_id,
      generation_job_id: input.job.id,
      owner_id: input.job.owner_id,
      glb_storage_path: path,
      file_size_bytes: bytes.byteLength,
      mesh_count: inspection.meshCount,
      triangle_count: inspection.triangleCount,
      material_count: inspection.materialCount,
      texture_count: inspection.textureCount,
      animation_names: inspection.animationNames,
      bounds: inspection.bounds,
      metadata: {
        source: 'image_to_3d',
        provider_metadata: input.providerMetadata,
        ingested_at: new Date().toISOString(),
        warnings: inspection.warnings,
      },
      processing_status: 'ready',
    })
    .select('*')
    .single();

  if (insertError || !model) {
    await input.service.storage.from(MODEL_BUCKET).remove([path]);
    throw new Error(`db insert failed: ${insertError?.message}`);
  }

  const { data: job } = await input.service
    .from('generation_jobs')
    .update({
      status: 'completed',
      stage: 'Complete',
      progress: 100,
      completed_at: new Date().toISOString(),
      result_metadata: {
        model_id: modelId,
        glb_storage_path: path,
        file_size_bytes: bytes.byteLength,
        mesh_count: inspection.meshCount,
        triangle_count: inspection.triangleCount,
      },
    })
    .eq('id', input.job.id)
    .select('*')
    .single();

  await input.service
    .from('ar_projects')
    .update({ status: 'generated', wizard_stage: 'saved' })
    .eq('id', input.job.project_id);

  return { job: job!, model };
}
