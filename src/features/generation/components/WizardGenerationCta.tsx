import { Link } from 'react-router-dom';

import { useLatestModelQuery } from '../../models/modelHooks';
import { useLatestGenerationJobQuery } from '../api/generationHooks';
import { resolveWizardPrimaryAction } from '../generationGates';
import type { SourceMethod } from '../../projects/types';

/**
 * Wizard Step 5 CTA for photo projects. Routes into the existing Batch 3
 * generation page or GLB Studio — does not start a paid Meshy job itself.
 */
export function WizardGenerationCta({
  projectId,
  projectStatus,
  sourceMethod,
  wizardStage,
  imageCount,
}: {
  projectId: string;
  projectStatus: string | null | undefined;
  sourceMethod: SourceMethod | null;
  wizardStage: string | null;
  imageCount: number;
}) {
  const jobQuery = useLatestGenerationJobQuery(projectId);
  const modelQuery = useLatestModelQuery(projectId);

  const action = resolveWizardPrimaryAction({
    projectId,
    projectStatus,
    sourceMethod,
    wizardStage,
    imageCount,
    jobStatus: jobQuery.data?.status ?? null,
    hasGeneratedModel: Boolean(modelQuery.data),
  });

  return (
    <div className="wizard-generation-cta" aria-label="Next step">
      <p>{action.supportingCopy}</p>
      <div className="wizard-actions">
        {action.to ? (
          <Link className="dash-button" to={action.to}>
            {action.label}
          </Link>
        ) : (
          <button type="button" className="dash-button" disabled title={action.blockedReason}>
            {action.label}
          </button>
        )}
        <Link className="dash-button-secondary" to={`/dashboard/projects/${projectId}/generate`}>
          Open generation page
        </Link>
      </div>
      {action.kind === 'blocked' && action.blockedReason && (
        <p className="dash-page-sub" role="status">
          {action.blockedReason}
        </p>
      )}
    </div>
  );
}
