import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  archiveProject,
  countMyProjects,
  createProject,
  deleteProject,
  getProject,
  listMyProjects,
  updateProject,
  type CreateProjectInput,
  type UpdateProjectInput,
} from './projectService';

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  counts: () => [...projectKeys.all, 'counts'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

export function useProjectsQuery() {
  return useQuery({ queryKey: projectKeys.list(), queryFn: listMyProjects });
}

export function useProjectCountsQuery() {
  return useQuery({ queryKey: projectKeys.counts(), queryFn: countMyProjects });
}

export function useProjectQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? 'missing'),
    queryFn: () => getProject(projectId as string),
    enabled: Boolean(projectId),
  });
}

function useInvalidateProjects() {
  const qc = useQueryClient();
  return (projectId?: string) => {
    void qc.invalidateQueries({ queryKey: projectKeys.list() });
    void qc.invalidateQueries({ queryKey: projectKeys.counts() });
    if (projectId) {
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    }
  };
}

export function useCreateProjectMutation() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (project) => invalidate(project.id),
  });
}

export function useUpdateProjectMutation() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(input),
    onSuccess: (project) => invalidate(project.id),
  });
}

export function useArchiveProjectMutation() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (projectId: string) => archiveProject(projectId),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteProjectMutation() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => invalidate(),
  });
}
