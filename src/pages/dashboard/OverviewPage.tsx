import { Link } from 'react-router-dom';

import { useProjectCountsQuery } from '../../features/projects/api/projectHooks';

export default function OverviewPage() {
  const counts = useProjectCountsQuery();

  return (
    <div>
      <h1 className="dash-page-title">Overview</h1>
      <p className="dash-page-sub">Your AR projects at a glance.</p>

      {counts.isPending && (
        <div className="dash-stats" aria-label="Loading statistics">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="dash-skeleton" />
          ))}
        </div>
      )}

      {counts.isError && (
        <div className="dash-error" role="alert">
          {counts.error instanceof Error
            ? counts.error.message
            : 'Loading statistics failed.'}
        </div>
      )}

      {counts.isSuccess && counts.data.total === 0 && (
        <div className="dash-empty">
          <p>No projects yet.</p>
          <p>
            Create your first markerless AR project: photograph an object,
            generate a 3D model, and share it with a QR code.
          </p>
          <Link className="dash-button" to="/dashboard/projects/new">
            Create your first project
          </Link>
        </div>
      )}

      {counts.isSuccess && counts.data.total > 0 && (
        <div className="dash-stats">
          <div className="dash-stat">
            <div className="dash-stat-value">{counts.data.total}</div>
            <div className="dash-stat-label">Total projects</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-value">{counts.data.draft}</div>
            <div className="dash-stat-label">Drafts</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-value">{counts.data.generated}</div>
            <div className="dash-stat-label">With a 3D model</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-value">{counts.data.published}</div>
            <div className="dash-stat-label">Published</div>
          </div>
        </div>
      )}
    </div>
  );
}
