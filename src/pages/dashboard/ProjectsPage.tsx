import { Link } from 'react-router-dom';

import {
  useArchiveProjectMutation,
  useDeleteProjectMutation,
  useProjectsQuery,
} from '../../features/projects/api/projectHooks';
import { ProjectCard } from '../../features/projects/components/ProjectCard';
import type { ArProject } from '../../features/projects/types';

export default function ProjectsPage() {
  const projects = useProjectsQuery();
  const archive = useArchiveProjectMutation();
  const remove = useDeleteProjectMutation();

  const onArchive = (project: ArProject) => {
    if (window.confirm(`Archive "${project.name}"? It will disappear from this list.`)) {
      archive.mutate(project.id);
    }
  };

  const onDelete = (project: ArProject) => {
    if (
      window.confirm(
        `Permanently delete "${project.name}" and all of its uploaded images? This cannot be undone.`,
      )
    ) {
      remove.mutate(project.id);
    }
  };

  return (
    <div>
      <h1 className="dash-page-title">Projects</h1>
      <p className="dash-page-sub">Everything you're working on.</p>

      {(archive.isError || remove.isError) && (
        <div className="dash-error" role="alert" style={{ marginBottom: 16 }}>
          {archive.error instanceof Error
            ? archive.error.message
            : remove.error instanceof Error
              ? remove.error.message
              : 'The action failed. Please try again.'}
        </div>
      )}

      {projects.isPending && (
        <div className="project-grid" aria-label="Loading projects">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dash-skeleton" style={{ minHeight: 160 }} />
          ))}
        </div>
      )}

      {projects.isError && (
        <div className="dash-error" role="alert">
          {projects.error instanceof Error
            ? projects.error.message
            : 'Loading projects failed.'}
        </div>
      )}

      {projects.isSuccess && projects.data.length === 0 && (
        <div className="dash-empty">
          <p>No projects yet.</p>
          <Link className="dash-button" to="/dashboard/projects/new">
            Create a project
          </Link>
        </div>
      )}

      {projects.isSuccess && projects.data.length > 0 && (
        <div className="project-grid">
          {projects.data.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onArchive={onArchive}
              onDelete={onDelete}
              busy={archive.isPending || remove.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
