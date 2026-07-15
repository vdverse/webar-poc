import { Link, useParams } from 'react-router-dom';

import { useProjectQuery } from '../../features/projects/api/projectHooks';
import { useSourceImagesQuery } from '../../features/uploads/sourceImageHooks';
import { GenerationPanel } from '../../features/generation/components/GenerationPanel';

export default function GenerationJobPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectQuery(projectId);
  const images = useSourceImagesQuery(projectId);

  if (!projectId) {
    return <div className="dash-error">Missing project id.</div>;
  }

  if (project.isPending) {
    return <div className="dash-skeleton" style={{ minHeight: 200 }} aria-label="Loading" />;
  }

  if (project.isError || !project.data) {
    return (
      <div className="dash-error" role="alert">
        Project not found.
      </div>
    );
  }

  const p = project.data;

  return (
    <div className="dash-page">
      <p className="dash-breadcrumb">
        <Link to="/dashboard/projects">Projects</Link>
        {' / '}
        <Link to={`/dashboard/projects/${p.id}`}>{p.name}</Link>
        {' / '}
        Generate
      </p>
      <h1 className="dash-page-title">Generate 3D model</h1>
      <p className="dash-page-sub">
        Photos stay private. Generation runs on the server. When complete, use the same GLB studio,
        publish, and QR flow as a manual upload.
      </p>
      <GenerationPanel
        projectId={p.id}
        projectName={p.name}
        sourceMethod={p.source_method}
        wizardStage={p.wizard_stage}
        imageCount={images.data?.length ?? 0}
      />
    </div>
  );
}
