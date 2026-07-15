import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { GlbUploader } from '../../features/models/components/GlbUploader';
import { useLatestModelQuery } from '../../features/models/modelHooks';
import {
  useProjectQuery,
  useUpdateProjectMutation,
} from '../../features/projects/api/projectHooks';
import { ProjectForm } from '../../features/projects/components/ProjectForm';
import { WizardSteps, type WizardStepKey } from '../../features/projects/components/WizardSteps';
import type { SourceMethod, WizardStage } from '../../features/projects/types';
import { ImageUploader } from '../../features/uploads/components/ImageUploader';
import { SignedThumb } from '../../features/uploads/components/SignedThumb';
import {
  MULTI_VIEW_IMAGE_MAX_BYTES,
  MULTI_VIEW_MAX_IMAGES,
  MULTI_VIEW_MIN_IMAGES,
  SINGLE_IMAGE_MAX_BYTES,
} from '../../features/uploads/imageValidation';
import { useSourceImagesQuery } from '../../features/uploads/sourceImageHooks';
import { GenerationPanel } from '../../features/generation/components/GenerationPanel';

/**
 * Steps 2–5 of the creation wizard. The database is the source of truth for
 * where the creator is: project.wizard_stage (persisted on every
 * transition) plus the saved source images. A refresh, another device, or
 * coming back a week later all resume from the same place. The optional
 * `forceStage` prop backs the /dashboard/projects/:id/source route, which
 * jumps straight to the photo step.
 */
export default function ProjectWizardPage({ forceStage }: { forceStage?: WizardStage }) {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectQuery(projectId);
  const update = useUpdateProjectMutation();
  const images = useSourceImagesQuery(projectId);
  const latestModel = useLatestModelQuery(projectId);
  const [editingDetails, setEditingDetails] = useState(false);

  if (project.isPending) {
    return <div className="dash-skeleton" style={{ minHeight: 200 }} aria-label="Loading project" />;
  }

  if (project.isError) {
    const message =
      project.error instanceof Error ? project.error.message : 'Loading the project failed.';
    return (
      <div className="dash-error" role="alert">
        {message} {message.includes('not found') && 'It may have been deleted, or it may belong to a different account.'}
      </div>
    );
  }

  const p = project.data;
  const stage: WizardStage = forceStage ?? p.wizard_stage ?? 'source_method';
  // Step 1 happened on the create page; treat 'details' as source_method.
  const effectiveStage: WizardStepKey = stage === 'details' ? 'source_method' : stage;
  const imageCount = images.data?.length ?? 0;

  const goTo = (next: WizardStage, extra?: { source_method?: SourceMethod }) => {
    update.mutate({ projectId: p.id, wizard_stage: next, ...extra });
  };

  const isGlb = p.source_method === 'glb_upload';
  const minImages = p.source_method === 'multi_view' ? MULTI_VIEW_MIN_IMAGES : 1;
  const captureComplete = isGlb ? Boolean(latestModel.data) : imageCount >= minImages;

  return (
    <div>
      <h1 className="dash-page-title">{p.name}</h1>
      <p className="dash-page-sub">
        {p.mode === 'markerless_surface' ? 'Markerless AR project' : 'Image target AR project'}
        {' · '}
        <button
          className="dash-button-secondary"
          style={{ padding: '2px 10px', fontSize: '0.8rem' }}
          onClick={() => setEditingDetails((v) => !v)}
        >
          {editingDetails ? 'Close details' : 'Edit details'}
        </button>
      </p>

      {editingDetails && (
        <div style={{ marginBottom: 28 }}>
          <ProjectForm
            defaultValues={{
              name: p.name,
              description: p.description ?? '',
              mode: p.mode,
            }}
            submitLabel="Save details"
            busy={update.isPending}
            onSubmit={(values) => {
              update.mutate(
                {
                  projectId: p.id,
                  name: values.name,
                  description: values.description || null,
                },
                { onSuccess: () => setEditingDetails(false) },
              );
            }}
          />
        </div>
      )}

      <WizardSteps current={effectiveStage} />

      {update.isError && (
        <div className="dash-error" role="alert" style={{ marginBottom: 16 }}>
          {update.error instanceof Error ? update.error.message : 'Saving failed.'}
        </div>
      )}

      {effectiveStage === 'source_method' && (
        <section aria-label="Choose a source method">
          <p className="dash-page-sub">
            Step 2 of 5 — how will you provide the object?
          </p>
          <div className="method-grid">
            <button
              type="button"
              className={
                p.source_method === 'single_image'
                  ? 'method-card method-card--selected'
                  : 'method-card'
              }
              onClick={() => goTo('capture', { source_method: 'single_image' })}
            >
              <strong>Single image</strong>
              <p>
                One clear photo. Fastest path — good for simple objects with a
                plain background.
              </p>
            </button>
            <button
              type="button"
              className={
                p.source_method === 'multi_view'
                  ? 'method-card method-card--selected'
                  : 'method-card'
              }
              onClick={() => goTo('capture', { source_method: 'multi_view' })}
            >
              <strong>Multiple-angle photos</strong>
              <p>
                2–12 photos around the object for better reconstruction. Takes
                longer to capture, usually more faithful.
              </p>
            </button>
            <button
              type="button"
              className={
                p.source_method === 'glb_upload'
                  ? 'method-card method-card--selected'
                  : 'method-card'
              }
              onClick={() => goTo('capture', { source_method: 'glb_upload' })}
            >
              <strong>Upload an existing GLB</strong>
              <p>
                Bring a ready-made 3D model. Preview, adjust, and publish to a
                public AR link with QR — no image-to-3D generation required.
              </p>
            </button>
          </div>
        </section>
      )}

      {effectiveStage === 'capture' && p.source_method === 'glb_upload' && (
        <section aria-label="Upload GLB">
          <p className="dash-page-sub">Step 3 of 5 — upload a .glb file (max 25 MB).</p>
          <GlbUploader
            projectId={p.id}
            onUploaded={() => {
              void latestModel.refetch();
            }}
          />
          <div className="wizard-actions">
            <button
              className="dash-button-secondary"
              onClick={() => goTo('source_method')}
              disabled={update.isPending}
            >
              Back
            </button>
            <button
              className="dash-button"
              onClick={() => goTo('review')}
              disabled={!captureComplete || update.isPending}
            >
              Continue to review
            </button>
            <Link className="dash-button-secondary" to={`/dashboard/projects/${p.id}/studio`}>
              Open studio
            </Link>
          </div>
        </section>
      )}

      {effectiveStage === 'capture' && p.source_method && p.source_method !== 'glb_upload' && (
        <section aria-label="Add photos">
          <p className="dash-page-sub">
            Step 3 of 5 —{' '}
            {p.source_method === 'single_image'
              ? 'add one photo of the object.'
              : 'capture the object from multiple angles.'}
          </p>
          <ImageUploader
            projectId={p.id}
            mode={p.source_method === 'single_image' ? 'single' : 'multi'}
            maxBytesPerImage={
              p.source_method === 'single_image'
                ? SINGLE_IMAGE_MAX_BYTES
                : MULTI_VIEW_IMAGE_MAX_BYTES
            }
            maxImages={p.source_method === 'single_image' ? 1 : MULTI_VIEW_MAX_IMAGES}
          />
          <div className="wizard-actions">
            <button
              className="dash-button-secondary"
              onClick={() => goTo('source_method')}
              disabled={update.isPending}
            >
              Back
            </button>
            <button
              className="dash-button"
              onClick={() => goTo('review')}
              disabled={!captureComplete || update.isPending}
            >
              Continue to review
            </button>
            {!captureComplete && (
              <p className="dash-field-hint" style={{ alignSelf: 'center' }}>
                {p.source_method === 'single_image'
                  ? 'Add a photo to continue.'
                  : `Add at least ${minImages} photos to continue.`}
              </p>
            )}
          </div>
        </section>
      )}

      {effectiveStage === 'capture' && !p.source_method && (
        <div className="dash-error" role="alert">
          Choose a source method first.
          <button
            className="dash-button-secondary"
            style={{ marginLeft: 12 }}
            onClick={() => goTo('source_method')}
          >
            Choose method
          </button>
        </div>
      )}

      {effectiveStage === 'review' && (
        <section aria-label="Review">
          <p className="dash-page-sub">Step 4 of 5 — check everything before saving.</p>
          <dl className="review-summary">
            <div className="review-row">
              <dt>Project</dt>
              <dd>{p.name}</dd>
            </div>
            <div className="review-row">
              <dt>Source method</dt>
              <dd>
                {p.source_method === 'single_image'
                  ? 'Single image'
                  : p.source_method === 'multi_view'
                    ? 'Multiple-angle photos'
                    : p.source_method === 'glb_upload'
                      ? 'Existing GLB'
                      : '—'}
              </dd>
            </div>
            {isGlb ? (
              <div className="review-row">
                <dt>Model</dt>
                <dd>
                  {latestModel.data
                    ? `${latestModel.data.mesh_count ?? '—'} meshes · ${(latestModel.data.triangle_count ?? 0).toLocaleString()} tris`
                    : 'No GLB uploaded'}
                </dd>
              </div>
            ) : (
              <div className="review-row">
                <dt>Images</dt>
                <dd>{imageCount}</dd>
              </div>
            )}
          </dl>

          {!isGlb && imageCount > 0 && images.data && (
            <div className="upload-grid" style={{ maxWidth: 720 }}>
              {images.data.map((img) => (
                <div className="upload-item" key={img.id}>
                  <SignedThumb path={img.storage_path} alt={img.original_filename ?? 'Source image'} />
                  <div className="upload-item-body">
                    <span className="upload-item-name">{img.original_filename}</span>
                    <span className="upload-item-meta">
                      {img.width}×{img.height}
                      {img.angle_label ? ` · ${img.angle_label}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="wizard-actions">
            <button
              className="dash-button-secondary"
              onClick={() => goTo('capture')}
              disabled={update.isPending}
            >
              {isGlb ? 'Back to upload' : 'Back to photos'}
            </button>
            <button
              className="dash-button"
              onClick={() => goTo('saved')}
              disabled={!captureComplete || update.isPending}
            >
              Save project
            </button>
          </div>
        </section>
      )}

      {effectiveStage === 'saved' && (
        <section aria-label="Saved">
          <p className="dash-page-sub">Step 5 of 5 — saved.</p>
          <div className="dash-empty" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
            {isGlb ? (
              <>
                <p>
                  <strong>{p.name}</strong> has a GLB ready. Open the studio to preview, adjust
                  scene settings, publish a public link, and generate a QR code.
                </p>
                <div className="wizard-actions">
                  <Link className="dash-button" to={`/dashboard/projects/${p.id}/studio`}>
                    Open GLB studio
                  </Link>
                  <button
                    className="dash-button-secondary"
                    onClick={() => goTo('capture')}
                    disabled={update.isPending}
                  >
                    Replace GLB
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  <strong>{p.name}</strong> is saved with {imageCount}{' '}
                  {imageCount === 1 ? 'image' : 'images'}. Your photos are stored
                  privately — they are never shown to viewers.
                </p>
                <p>
                  Generate a textured GLB on the server (provider key required), then open
                  the same GLB studio used for direct uploads. Direct GLB upload remains
                  available anytime.
                </p>
                {projectId && (
                  <GenerationPanel
                    projectId={projectId}
                    projectName={p.name}
                    sourceMethod={p.source_method}
                    wizardStage={p.wizard_stage}
                    imageCount={imageCount}
                  />
                )}
                <div className="wizard-actions">
                  <Link className="dash-button-secondary" to={`/dashboard/projects/${p.id}/generate`}>
                    Open generation page
                  </Link>
                  <button
                    className="dash-button-secondary"
                    onClick={() => goTo('capture')}
                    disabled={update.isPending}
                  >
                    Edit photos
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
