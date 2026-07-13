import { Link } from 'react-router-dom';

import type { ArProject } from '../types';

const STATUS_LABELS: Record<ArProject['status'], string> = {
  draft: 'Draft',
  uploading: 'Uploading',
  generating: 'Generating',
  generated: 'Model ready',
  editing: 'Editing',
  ready: 'Ready to publish',
  published: 'Published',
  generation_failed: 'Generation failed',
  archived: 'Archived',
};

interface Props {
  project: ArProject;
  onArchive: (project: ArProject) => void;
  onDelete: (project: ArProject) => void;
  busy?: boolean;
}

export function ProjectCard({ project, onArchive, onDelete, busy }: Props) {
  const created = new Date(project.created_at).toLocaleDateString();
  return (
    <article className="project-card" aria-label={project.name}>
      <span className={`status-badge status-${project.status}`}>
        {STATUS_LABELS[project.status]}
      </span>
      <h3>{project.name}</h3>
      {project.description && (
        <p className="project-card-desc">{project.description}</p>
      )}
      <div className="project-card-meta">
        {project.mode === 'markerless_surface' ? 'Markerless AR' : 'Image target AR'}
        {' · created '}
        {created}
      </div>
      <div className="project-card-actions">
        <Link className="dash-button" to={`/dashboard/projects/${project.id}`}>
          Open
        </Link>
        <button
          className="dash-button-secondary"
          onClick={() => onArchive(project)}
          disabled={busy}
        >
          Archive
        </button>
        <button
          className="dash-button-danger"
          onClick={() => onDelete(project)}
          disabled={busy}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
