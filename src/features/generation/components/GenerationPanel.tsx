import { Link } from 'react-router-dom';

import { useLatestModelQuery } from '../../models/modelHooks';
import { evaluateGenerateGate } from '../generationGates';
import {
  useCancelGenerationMutation,
  useCreateGenerationMutation,
  useGenerationStatusPolling,
  useLatestGenerationJobQuery,
} from '../api/generationHooks';
import { GenerationServiceError } from '../api/generationService';
import { isActiveGenerationStatus } from '../types';
import type { SourceMethod } from '../../projects/types';
import { GenerationChecklist } from './GenerationChecklist';
import { GenerationProgress } from './GenerationProgress';

export function GenerationPanel({
  projectId,
  projectName,
  sourceMethod,
  wizardStage,
  imageCount,
}: {
  projectId: string;
  projectName: string;
  sourceMethod: SourceMethod | null;
  wizardStage: string | null;
  imageCount: number;
}) {
  const jobQuery = useLatestGenerationJobQuery(projectId);
  const modelQuery = useLatestModelQuery(projectId);
  const create = useCreateGenerationMutation(projectId);
  const cancel = useCancelGenerationMutation(projectId);

  const job = jobQuery.data;
  const active = Boolean(job && isActiveGenerationStatus(job.status));
  useGenerationStatusPolling(projectId, active);

  // null = unknown (optimistic allow until first 503); false after provider-not-configured
  const providerConfigured =
    create.error instanceof GenerationServiceError &&
    create.error.code === 'provider-not-configured'
      ? false
      : null;

  const gate = evaluateGenerateGate({
    sourceMethod,
    wizardStage,
    imageCount,
    imagesUploading: false,
    activeJob: job ?? null,
    providerConfigured,
  });

  const submitting = create.isPending;
  const canClick = gate.canGenerate && !submitting && !active;

  return (
    <div className="generation-panel" aria-label="Image to 3D generation">
      <GenerationChecklist multiView={sourceMethod === 'multi_view'} />

      {job && <GenerationProgress job={job} />}

      {job?.status === 'completed' && modelQuery.data && (
        <div className="dash-empty" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
          <p>
            <strong>{projectName}</strong> has a generated model ready for the existing GLB studio.
          </p>
          <div className="wizard-actions">
            <Link className="dash-button" to={`/dashboard/projects/${projectId}/studio`}>
              Open GLB Studio
            </Link>
          </div>
        </div>
      )}

      <div className="wizard-actions">
        <button
          type="button"
          className="dash-button"
          disabled={!canClick}
          title={!canClick ? gate.message : 'Start image-to-3D generation'}
          onClick={() => create.mutate()}
        >
          {submitting ? 'Starting…' : 'Generate 3D model'}
        </button>
        {active && job && (
          <button
            type="button"
            className="dash-button-secondary"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(job.id)}
          >
            Cancel
          </button>
        )}
        {job?.status === 'failed' && (
          <button
            type="button"
            className="dash-button-secondary"
            disabled={submitting}
            onClick={() => create.mutate()}
          >
            Retry
          </button>
        )}
      </div>

      {!canClick && gate.reason !== 'ok' && gate.reason !== 'active-job' && (
        <p className="dash-page-sub" role="status">
          {gate.message}
        </p>
      )}

      {create.isError && (
        <div className="dash-error" role="alert">
          {create.error instanceof Error ? create.error.message : 'Could not start generation.'}
        </div>
      )}
    </div>
  );
}
