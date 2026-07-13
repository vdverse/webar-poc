import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AngleLabel, ProjectSourceImage } from '../projects/types';
import {
  createSignedPreviewUrl,
  deleteSourceImage,
  listSourceImages,
  updateSourceImageOrder,
  uploadSourceImage,
  type UploadSourceImageInput,
} from './sourceImageService';

export const sourceImageKeys = {
  list: (projectId: string) => ['source-images', projectId] as const,
  preview: (path: string) => ['source-image-preview', path] as const,
};

export function useSourceImagesQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: sourceImageKeys.list(projectId ?? 'missing'),
    queryFn: () => listSourceImages(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useSignedPreviewQuery(storagePath: string) {
  return useQuery({
    queryKey: sourceImageKeys.preview(storagePath),
    queryFn: () => createSignedPreviewUrl(storagePath),
    // Signed URLs live 30 min; refresh comfortably before expiry and never
    // persist them anywhere.
    staleTime: 20 * 60 * 1000,
  });
}

export function useUploadSourceImageMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadSourceImageInput) => uploadSourceImage(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sourceImageKeys.list(projectId) });
    },
  });
}

export function useDeleteSourceImageMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (image: ProjectSourceImage) => deleteSourceImage(image),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sourceImageKeys.list(projectId) });
    },
  });
}

export function useReorderSourceImagesMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      images: { id: string; sort_order: number; angle_label: AngleLabel | null }[],
    ) => updateSourceImageOrder(images),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sourceImageKeys.list(projectId) });
    },
  });
}
