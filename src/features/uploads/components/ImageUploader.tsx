import { useEffect, useRef, useState } from 'react';

import type { AngleLabel, ProjectSourceImage } from '../../projects/types';
import { ANGLE_LABELS } from '../../projects/types';
import {
  checkImageRules,
  checkImageSetRules,
  compressForUpload,
  decodeImage,
  hasBlockingIssue,
  hashFileContent,
  type CandidateImage,
  type ImageIssue,
} from '../imageValidation';
import {
  useDeleteSourceImageMutation,
  useReorderSourceImagesMutation,
  useSourceImagesQuery,
  useUploadSourceImageMutation,
} from '../sourceImageHooks';
import { SignedThumb } from './SignedThumb';

interface Props {
  projectId: string;
  mode: 'single' | 'multi';
  maxBytesPerImage: number;
  maxImages: number;
}

interface InFlightItem {
  id: string;
  filename: string;
  previewUrl: string;
  state: 'uploading' | 'failed';
  errorMessage?: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageUploader({ projectId, mode, maxBytesPerImage, maxImages }: Props) {
  const images = useSourceImagesQuery(projectId);
  const upload = useUploadSourceImageMutation(projectId);
  const remove = useDeleteSourceImageMutation(projectId);
  const reorder = useReorderSourceImagesMutation(projectId);

  const [issues, setIssues] = useState<ImageIssue[]>([]);
  const [inFlight, setInFlight] = useState<InFlightItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  // Revoke every object URL created for local previews on unmount.
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const existing = images.data ?? [];
  const existingCount = existing.length;

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setIssues([]);

    // In single mode, a new selection replaces: only take the first file,
    // and it's an error to already have one (the UI offers Replace instead).
    const selected = mode === 'single' ? files.slice(0, 1) : files;

    // Decode + hash each candidate up front so validation sees dimensions
    // and duplicate content.
    const candidates: CandidateImage[] = [];
    const decodedFiles: { file: File; width: number; height: number }[] = [];
    const collected: ImageIssue[] = [];
    for (const file of selected) {
      const dims = await decodeImage(file);
      if (!dims) {
        collected.push({
          level: 'error',
          code: 'decode-failed',
          message: `${file.name}: the file could not be read as an image — it may be corrupt.`,
        });
        continue;
      }
      const contentHash = await hashFileContent(file);
      const candidate: CandidateImage = {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        width: dims.width,
        height: dims.height,
        contentHash,
      };
      const fileIssues = checkImageRules(candidate, maxBytesPerImage);
      collected.push(...fileIssues);
      if (!hasBlockingIssue(fileIssues)) {
        candidates.push(candidate);
        decodedFiles.push({ file, ...dims });
      }
    }

    // Cross-file rules include images already uploaded to this project.
    const existingAsCandidates: CandidateImage[] = existing.map((img) => ({
      filename: img.original_filename ?? img.storage_path,
      mimeType: img.mime_type ?? 'image/jpeg',
      sizeBytes: img.file_size_bytes ?? 0,
    }));
    const setIssuesFound = checkImageSetRules(
      [...existingAsCandidates, ...candidates],
      { minImages: 0, maxImages },
    );
    collected.push(...setIssuesFound);
    setIssues(collected);

    if (setIssuesFound.some((i) => i.code === 'too-many-images')) {
      return; // don't upload past the cap
    }

    // Upload sequentially: clearer failure attribution and gentler on
    // mobile connections than parallel uploads.
    let sortOrder = existingCount;
    for (const { file, width, height } of decodedFiles) {
      const itemId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.push(previewUrl);
      setInFlight((prev) => [
        ...prev,
        { id: itemId, filename: file.name, previewUrl, state: 'uploading' },
      ]);
      setAnnouncement(`Uploading ${file.name}`);
      try {
        const prepared = await compressForUpload(file);
        await upload.mutateAsync({
          projectId,
          file: prepared,
          width,
          height,
          angleLabel: null,
          sortOrder: sortOrder++,
        });
        setInFlight((prev) => prev.filter((i) => i.id !== itemId));
        setAnnouncement(`${file.name} uploaded`);
      } catch (err) {
        setInFlight((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  state: 'failed',
                  errorMessage:
                    err instanceof Error ? err.message : 'Upload failed. Please retry.',
                }
              : i,
          ),
        );
        setAnnouncement(`${file.name} failed to upload`);
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    void handleFiles(e.dataTransfer.files);
  };

  const move = (index: number, delta: number) => {
    const next = [...existing];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(
      next.map((img, i) => ({
        id: img.id,
        sort_order: i,
        angle_label: (img.angle_label as AngleLabel | null) ?? null,
      })),
    );
  };

  const setAngle = (image: ProjectSourceImage, angle: string) => {
    reorder.mutate(
      existing.map((img, i) => ({
        id: img.id,
        sort_order: i,
        angle_label:
          img.id === image.id
            ? angle === ''
              ? null
              : (angle as AngleLabel)
            : ((img.angle_label as AngleLabel | null) ?? null),
      })),
    );
  };

  const atCapacity = existingCount >= maxImages;
  const singleHasImage = mode === 'single' && existingCount >= 1;

  return (
    <div>
      <div aria-live="polite" className="visually-hidden" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {announcement}
      </div>

      {!singleHasImage && !atCapacity && (
        <div
          className={dragActive ? 'upload-drop upload-drop--active' : 'upload-drop'}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <p>
            {mode === 'single'
              ? 'Add one clear photo of the object.'
              : `Add 2–${maxImages} photos from different angles.`}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="dash-button"
              onClick={() => galleryInputRef.current?.click()}
            >
              Choose from gallery
            </button>
            <button
              type="button"
              className="dash-button-secondary"
              onClick={() => cameraInputRef.current?.click()}
            >
              Take a photo
            </button>
          </div>
          <p className="dash-field-hint">or drag and drop images here · JPEG, PNG or WebP</p>
        </div>
      )}

      {/* Gallery input: no capture attribute so desktop browsers and photo
          pickers behave normally. */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={mode === 'multi'}
        hidden
        aria-label="Choose images from gallery"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {/* Camera input: capture=environment hints the rear camera on mobile;
          desktop browsers fall back to a normal file picker. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        aria-label="Take a photo with the camera"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {mode === 'single' ? (
        <ul className="upload-guidance">
          <li>Centre the object and show all of it — avoid cropped edges.</li>
          <li>Use a simple background and good, even lighting.</li>
          <li>Avoid motion blur and reflections where possible.</li>
        </ul>
      ) : (
        <ul className="upload-guidance">
          <li>
            Recommended sequence: front, front-right, right, back-right, back,
            back-left, left, front-left — plus top and close details if useful.
          </li>
          <li>Keep the object, distance and lighting consistent between shots.</li>
          <li>More angles usually help, but no photo set guarantees a perfect model.</li>
        </ul>
      )}

      {issues.length > 0 && (
        <ul className="upload-issues">
          {issues.map((issue, i) => (
            <li
              key={i}
              className={`upload-issue upload-issue--${issue.level}`}
              role={issue.level === 'error' ? 'alert' : undefined}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {images.isError && (
        <div className="dash-error" role="alert" style={{ marginTop: 16 }}>
          {images.error instanceof Error ? images.error.message : 'Loading images failed.'}
        </div>
      )}

      {(existing.length > 0 || inFlight.length > 0) && (
        <div className="upload-grid">
          {existing.map((img, index) => (
            <div className="upload-item" key={img.id}>
              <SignedThumb
                path={img.storage_path}
                alt={img.original_filename ?? 'Source image'}
              />
              <div className="upload-item-body">
                <span className="upload-item-name">{img.original_filename}</span>
                <span className="upload-item-meta">
                  {img.width}×{img.height} · {formatBytes(img.file_size_bytes)}
                </span>
                {mode === 'multi' && (
                  <select
                    aria-label={`Angle for ${img.original_filename}`}
                    value={img.angle_label ?? ''}
                    onChange={(e) => setAngle(img, e.target.value)}
                  >
                    <option value="">No angle label</option>
                    {ANGLE_LABELS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                )}
                <div className="upload-item-actions">
                  {mode === 'multi' && (
                    <>
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0 || reorder.isPending}
                        aria-label={`Move ${img.original_filename} earlier`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === existing.length - 1 || reorder.isPending}
                        aria-label={`Move ${img.original_filename} later`}
                      >
                        ↓
                      </button>
                    </>
                  )}
                  {mode === 'single' && (
                    <button
                      type="button"
                      onClick={() => {
                        remove.mutate(img);
                        galleryInputRef.current?.click();
                      }}
                      disabled={remove.isPending}
                    >
                      Replace
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove.mutate(img)}
                    disabled={remove.isPending}
                    aria-label={`Remove ${img.original_filename}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {inFlight.map((item) => (
            <div className="upload-item" key={item.id}>
              <img className="upload-thumb" src={item.previewUrl} alt={item.filename} />
              <div className="upload-item-body">
                <span className="upload-item-name">{item.filename}</span>
                {item.state === 'uploading' ? (
                  <>
                    <span className="upload-item-meta">Uploading…</span>
                    <div className="upload-progress" role="progressbar" aria-label={`Uploading ${item.filename}`}>
                      <div className="upload-progress-bar" style={{ width: '100%', opacity: 0.5 }} />
                    </div>
                  </>
                ) : (
                  <>
                    <span className="upload-issue upload-issue--error">
                      {item.errorMessage}
                    </span>
                    <div className="upload-item-actions">
                      <button
                        type="button"
                        onClick={() =>
                          setInFlight((prev) => prev.filter((i) => i.id !== item.id))
                        }
                      >
                        Dismiss
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
