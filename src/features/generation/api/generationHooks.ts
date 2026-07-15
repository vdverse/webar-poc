import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import {
  cancelGenerationJob,
  createGenerationJob,
  GenerationServiceError,
  getGenerationStatus,
  getLatestJobForProject,
} from './generationService';
import { isActiveGenerationStatus } from '../types';

const jobKey = (projectId: string) => ['generation-job', projectId] as const;

export function useLatestGenerationJobQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: jobKey(projectId ?? ''),
    queryFn: () => getLatestJobForProject(projectId!),
    enabled: Boolean(projectId),
    refetchOnWindowFocus: true,
  });
}

export function useCreateGenerationMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createGenerationJob(projectId),
    onSuccess: (job) => {
      qc.setQueryData(jobKey(projectId), job);
    },
  });
}

export function useCancelGenerationMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => cancelGenerationJob(jobId),
    onSuccess: (job) => {
      qc.setQueryData(jobKey(projectId), job);
    },
  });
}

/**
 * Polls the secure status Edge Function while the job is active.
 * Pauses when the tab is hidden. Does not invent progress.
 */
export function useGenerationStatusPolling(projectId: string | undefined, enabled: boolean) {
  const qc = useQueryClient();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!projectId || !enabled) return;

    let cancelled = false;

    const clear = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') {
        timerRef.current = window.setTimeout(tick, 4000);
        return;
      }
      try {
        const { job } = await getGenerationStatus({ projectId });
        if (!cancelled) {
          qc.setQueryData(jobKey(projectId), job);
          if (isActiveGenerationStatus(job.status)) {
            timerRef.current = window.setTimeout(tick, 3000);
          }
        }
      } catch (e) {
        if (!cancelled) {
          // Soft-fail poll; keep trying while active unless auth died.
          if (e instanceof GenerationServiceError && e.code === 'unauthorized') return;
          timerRef.current = window.setTimeout(tick, 5000);
        }
      }
    };

    void tick();
    return () => {
      cancelled = true;
      clear();
    };
  }, [projectId, enabled, qc]);
}
