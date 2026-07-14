import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createGlbSignedUrl, getLatestModel, uploadGlbModel } from './glbUploadService';
import type { GlbMetadata } from './glbValidation';
import { getActivePublicationForProject, publishProject } from './publishService';
import { getSceneSettings, upsertSceneSettings, type SceneSettingsInput } from './sceneSettingsService';
import type { ArProject } from '../projects/types';
import type { GeneratedModel, SceneSettings } from './types';

export const modelKeys = {
  latest: (projectId: string) => ['generated-models', projectId, 'latest'] as const,
  signed: (path: string) => ['glb-signed', path] as const,
};

export const sceneKeys = {
  one: (projectId: string) => ['scene-settings', projectId] as const,
};

export const publishKeys = {
  active: (projectId: string) => ['publications', projectId, 'active'] as const,
};

export function useLatestModelQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: modelKeys.latest(projectId ?? ''),
    queryFn: () => getLatestModel(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useGlbSignedUrlQuery(storagePath: string | null | undefined) {
  return useQuery({
    queryKey: modelKeys.signed(storagePath ?? ''),
    queryFn: () => createGlbSignedUrl(storagePath!),
    enabled: Boolean(storagePath),
    staleTime: 30 * 60 * 1000,
  });
}

export function useUploadGlbMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; meta: GlbMetadata }) =>
      uploadGlbModel({ projectId, file: input.file, meta: input.meta }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: modelKeys.latest(projectId) });
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useSceneSettingsQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: sceneKeys.one(projectId ?? ''),
    queryFn: () => getSceneSettings(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useUpsertSceneSettingsMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SceneSettingsInput, 'projectId'>) =>
      upsertSceneSettings({ ...input, projectId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sceneKeys.one(projectId) });
    },
  });
}

export function useActivePublicationQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: publishKeys.active(projectId ?? ''),
    queryFn: () => getActivePublicationForProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function usePublishMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { project: ArProject; model: GeneratedModel; settings: SceneSettings }) =>
      publishProject(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: publishKeys.active(projectId) });
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
