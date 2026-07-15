import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { computeModelViewerScale, normalizeGlbBounds, parsePhysicalDimensionInput } from '../../features/models/arPlacement';
import { useProjectQuery } from '../../features/projects/api/projectHooks';
import { GlbUploader } from '../../features/models/components/GlbUploader';
import { ModelPreview } from '../../features/models/components/ModelPreview';
import { QrDisplay } from '../../features/models/components/QrDisplay';
import {
  SceneSettingsForm,
  type SceneSettingsFormValues,
} from '../../features/models/components/SceneSettingsForm';
import {
  useActivePublicationQuery,
  useGlbSignedUrlQuery,
  useLatestModelQuery,
  usePublishMutation,
  useSceneSettingsQuery,
  useUpsertSceneSettingsMutation,
} from '../../features/models/modelHooks';
import { buildPublicViewerUrl } from '../../features/models/publishService';
import { defaultSceneSettings } from '../../features/models/sceneSettingsService';
import type { ArScaleMode, SceneSettings } from '../../features/models/types';

function parseOptionalPhysical(raw: string): number | null {
  const parsed = parsePhysicalDimensionInput(raw);
  if (parsed === 'invalid') return null;
  return parsed;
}

export default function ProjectStudioPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectQuery(projectId);
  const model = useLatestModelQuery(projectId);
  const settingsQ = useSceneSettingsQuery(projectId);
  const publication = useActivePublicationQuery(projectId);
  const signed = useGlbSignedUrlQuery(model.data?.glb_storage_path);
  const saveSettings = useUpsertSceneSettingsMutation(projectId!);
  const publish = usePublishMutation(projectId!);

  const [liveSettings, setLiveSettings] = useState<SceneSettings | null>(null);

  const animations = useMemo(
    () => (Array.isArray(model.data?.animation_names) ? model.data!.animation_names : []),
    [model.data],
  );

  const effectiveSettings: SceneSettings | null =
    liveSettings ??
    settingsQ.data ??
    (project.data && model.data
      ? defaultSceneSettings(project.data.id, project.data.owner_id, model.data.id)
      : null);

  const previewViewerScale = useMemo(() => {
    if (!effectiveSettings || !model.data) return undefined;
    const bounds = normalizeGlbBounds(model.data.bounds);
    const cfg = effectiveSettings.viewer_config ?? {};
    return computeModelViewerScale({
      sceneScale: effectiveSettings.scale,
      bounds,
      physicalWidth: cfg.physicalWidth ?? null,
      physicalHeight: cfg.physicalHeight ?? null,
      physicalDepth: cfg.physicalDepth ?? null,
    }).scale;
  }, [effectiveSettings, model.data]);

  if (project.isPending || model.isPending) {
    return <div className="dash-skeleton" style={{ minHeight: 240 }} aria-label="Loading studio" />;
  }

  if (project.isError || !project.data) {
    return (
      <div className="dash-error" role="alert">
        {project.error instanceof Error ? project.error.message : 'Project not found.'}
      </div>
    );
  }

  const p = project.data;
  const viewerUrl = publication.data
    ? buildPublicViewerUrl(publication.data.public_slug)
    : null;

  const applyFormValues = (values: SceneSettingsFormValues): SceneSettings => ({
    project_id: p.id,
    owner_id: p.owner_id,
    model_id: model.data?.id ?? null,
    scale: values.scale,
    rotation_x: values.rotation_x,
    rotation_y: values.rotation_y,
    rotation_z: values.rotation_z,
    placement_mode: values.placement_mode,
    shadow_intensity: values.shadow_intensity,
    auto_rotate: values.auto_rotate,
    camera_controls: values.camera_controls,
    animation_name: values.animation_name || null,
    animation_autoplay: values.animation_autoplay,
    animation_loop: values.animation_loop,
    viewer_config: {
      physicalWidth: parseOptionalPhysical(values.physicalWidth) ?? undefined,
      physicalHeight: parseOptionalPhysical(values.physicalHeight) ?? undefined,
      physicalDepth: parseOptionalPhysical(values.physicalDepth) ?? undefined,
      arScaleMode: values.arScaleMode,
    },
    updated_at: new Date().toISOString(),
  });

  return (
    <div className="studio-page">
      <p className="dash-page-sub">
        <Link to={`/dashboard/projects/${p.id}`}>← Wizard</Link>
      </p>
      <h1 className="dash-page-title">{p.name}</h1>
      <p className="dash-page-sub">GLB studio — upload, preview, adjust, publish.</p>

      <div className="studio-grid">
        <section className="studio-preview" aria-label="3D preview">
          <ModelPreview
            src={signed.data ?? null}
            alt={p.name}
            settings={effectiveSettings}
            viewerScale={previewViewerScale}
          />
          {signed.isError && (
            <div className="dash-error" role="alert">
              Preview URL failed. Re-upload or refresh.
            </div>
          )}
        </section>

        <section className="studio-side" aria-label="Upload and settings">
          <h2>1. Upload GLB</h2>
          <GlbUploader
            projectId={p.id}
            onUploaded={() => {
              void model.refetch();
            }}
          />

          <h2 style={{ marginTop: 28 }}>2. Scene settings</h2>
          {!model.data ? (
            <p className="dash-field-hint">Upload a GLB first.</p>
          ) : (
            <SceneSettingsForm
              settings={settingsQ.data}
              animationNames={animations}
              modelBounds={model.data.bounds}
              busy={saveSettings.isPending}
              onChange={(values) => setLiveSettings(applyFormValues(values))}
              onSave={(values) => {
                const next = applyFormValues(values);
                setLiveSettings(next);
                saveSettings.mutate({
                  modelId: model.data!.id,
                  scale: next.scale,
                  rotation_x: next.rotation_x,
                  rotation_y: next.rotation_y,
                  rotation_z: next.rotation_z,
                  placement_mode: next.placement_mode,
                  shadow_intensity: next.shadow_intensity,
                  auto_rotate: next.auto_rotate,
                  camera_controls: next.camera_controls,
                  animation_name: next.animation_name,
                  animation_autoplay: next.animation_autoplay,
                  animation_loop: next.animation_loop,
                  physicalWidth: next.viewer_config.physicalWidth ?? null,
                  physicalHeight: next.viewer_config.physicalHeight ?? null,
                  physicalDepth: next.viewer_config.physicalDepth ?? null,
                  arScaleMode: (next.viewer_config.arScaleMode as ArScaleMode | undefined) ?? 'fixed',
                });
              }}
            />
          )}
          {saveSettings.isError && (
            <div className="dash-error" role="alert">
              {saveSettings.error instanceof Error
                ? saveSettings.error.message
                : 'Saving settings failed.'}
            </div>
          )}
          {saveSettings.isSuccess && <p className="dash-field-hint">Settings saved.</p>}

          <h2 style={{ marginTop: 28 }}>3. Publish</h2>
          <button
            type="button"
            className="dash-button"
            disabled={!model.data || publish.isPending || saveSettings.isPending}
            onClick={() => {
              if (!model.data) return;
              const settingsForPublish =
                settingsQ.data ??
                liveSettings ??
                defaultSceneSettings(p.id, p.owner_id, model.data.id);
              const run = async () => {
                let settings = settingsForPublish;
                if (!settingsQ.data) {
                  settings = await saveSettings.mutateAsync({
                    modelId: model.data!.id,
                    scale: settings.scale,
                    rotation_x: settings.rotation_x,
                    rotation_y: settings.rotation_y,
                    rotation_z: settings.rotation_z,
                    placement_mode: settings.placement_mode,
                    shadow_intensity: settings.shadow_intensity,
                    auto_rotate: settings.auto_rotate,
                    camera_controls: settings.camera_controls,
                    animation_name: settings.animation_name,
                    animation_autoplay: settings.animation_autoplay,
                    animation_loop: settings.animation_loop,
                    physicalWidth: settings.viewer_config.physicalWidth ?? null,
                    physicalHeight: settings.viewer_config.physicalHeight ?? null,
                    physicalDepth: settings.viewer_config.physicalDepth ?? null,
                    arScaleMode: settings.viewer_config.arScaleMode ?? 'fixed',
                  });
                }
                publish.mutate({
                  project: p,
                  model: model.data!,
                  settings: liveSettings ?? settings,
                });
              };
              void run();
            }}
          >
            {publish.isPending ? 'Publishing…' : 'Publish experience'}
          </button>
          {publish.isError && (
            <div className="dash-error" role="alert">
              {publish.error instanceof Error ? publish.error.message : 'Publish failed.'}
            </div>
          )}
          {(publish.data?.viewerUrl || viewerUrl) && (
            <div style={{ marginTop: 16 }}>
              <p>
                Live at{' '}
                <a
                  href={publish.data?.viewerUrl ?? viewerUrl!}
                  target="_blank"
                  rel="noreferrer"
                >
                  {publish.data?.viewerUrl ?? viewerUrl}
                </a>
              </p>
              <QrDisplay
                viewerUrl={publish.data?.viewerUrl ?? viewerUrl!}
                title={p.name}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
