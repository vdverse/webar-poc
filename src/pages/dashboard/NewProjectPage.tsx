import { useNavigate } from 'react-router-dom';

import { useCreateProjectMutation } from '../../features/projects/api/projectHooks';
import { ProjectForm } from '../../features/projects/components/ProjectForm';
import { WizardSteps } from '../../features/projects/components/WizardSteps';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const create = useCreateProjectMutation();

  return (
    <div>
      <h1 className="dash-page-title">Create a project</h1>
      <p className="dash-page-sub">
        Step 1 of 5 — name the AR experience you're building.
      </p>
      <WizardSteps current="details" />

      {create.isError && (
        <div className="dash-error" role="alert" style={{ marginBottom: 16 }}>
          {create.error instanceof Error
            ? create.error.message
            : 'Creating the project failed.'}
        </div>
      )}

      <ProjectForm
        submitLabel="Create project and continue"
        busy={create.isPending}
        onSubmit={(values) => {
          create.mutate(
            {
              name: values.name,
              description: values.description || undefined,
              mode: values.mode,
            },
            {
              onSuccess: (project) =>
                navigate(`/dashboard/projects/${project.id}`, { replace: true }),
            },
          );
        }}
      />
    </div>
  );
}
