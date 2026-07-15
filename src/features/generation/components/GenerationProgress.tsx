import { canShowNumericProgress } from '../types';
import type { GenerationJob } from '../types';
import { mapStatusLabel, nextActionForError } from '../generationGates';

export function GenerationProgress({ job }: { job: GenerationJob }) {
  const showPct = canShowNumericProgress(job.progress);
  return (
    <div className="generation-progress" aria-live="polite">
      <p>
        <strong>{mapStatusLabel(job.status)}</strong>
        {job.stage ? ` — ${job.stage}` : ''}
      </p>
      {showPct ? (
        <div
          className="generation-progress-bar"
          role="progressbar"
          aria-valuenow={job.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div style={{ width: `${job.progress}%` }} />
          <span>{job.progress}%</span>
        </div>
      ) : (
        <p className="dash-page-sub">
          {job.status === 'completed'
            ? 'Generation finished.'
            : 'Waiting for provider updates… progress is only shown when the provider reports it.'}
        </p>
      )}
      {job.safe_error_message && (
        <div className="dash-error" role="alert">
          <p>{job.safe_error_message}</p>
          <p>{nextActionForError(job.safe_error_code)}</p>
        </div>
      )}
      <p className="dash-page-sub">
        Started {new Date(job.created_at).toLocaleString()}
        {job.provider ? ` · provider: ${job.provider}` : ''}
      </p>
    </div>
  );
}
