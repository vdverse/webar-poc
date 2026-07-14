import { useId, useState } from 'react';

import { GlbValidationError, validateAndInspectGlb, type GlbMetadata } from '../glbValidation';
import { useUploadGlbMutation } from '../modelHooks';

export function GlbUploader({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded?: () => void;
}) {
  const inputId = useId();
  const upload = useUploadGlbMutation(projectId);
  const [meta, setMeta] = useState<GlbMetadata | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    setMeta(null);
    setInspecting(true);
    try {
      const inspected = await validateAndInspectGlb(file);
      setMeta(inspected);
      await upload.mutateAsync({ file, meta: inspected });
      onUploaded?.();
    } catch (err) {
      if (err instanceof GlbValidationError) {
        setLocalError(err.message);
      } else if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Upload failed.');
      }
    } finally {
      setInspecting(false);
    }
  };

  const busy = inspecting || upload.isPending;

  return (
    <div className="glb-uploader">
      <label className="dash-button" htmlFor={inputId} style={{ display: 'inline-block', cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Working…' : 'Choose .glb file'}
      </label>
      <input
        id={inputId}
        type="file"
        accept=".glb,model/gltf-binary"
        disabled={busy}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          void onFile(f);
          e.target.value = '';
        }}
      />
      <p className="dash-field-hint">GLB only · max 25 MB · validated in the browser before upload.</p>

      {localError && (
        <div className="dash-error" role="alert" style={{ marginTop: 12 }}>
          {localError}
        </div>
      )}

      {meta && (
        <dl className="review-summary" style={{ marginTop: 16 }}>
          <div className="review-row">
            <dt>Size</dt>
            <dd>{(meta.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</dd>
          </div>
          <div className="review-row">
            <dt>Bounds (m)</dt>
            <dd>
              {meta.bounds.width} × {meta.bounds.height} × {meta.bounds.depth}
            </dd>
          </div>
          <div className="review-row">
            <dt>Meshes / triangles</dt>
            <dd>
              {meta.meshCount} / {meta.triangleCount.toLocaleString()}
            </dd>
          </div>
          <div className="review-row">
            <dt>Materials / textures</dt>
            <dd>
              {meta.materialCount} / {meta.textureCount}
            </dd>
          </div>
          <div className="review-row">
            <dt>Animations</dt>
            <dd>{meta.animationNames.length ? meta.animationNames.join(', ') : 'None'}</dd>
          </div>
          {meta.warnings.length > 0 && (
            <div className="review-row">
              <dt>Warnings</dt>
              <dd>{meta.warnings.join(' ')}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
