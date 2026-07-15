import { useEffect, useState } from 'react';

import { PLACEMENT_MODES, AR_SCALE_MODES, type ArScaleMode, type PlacementMode, type SceneSettings } from '../types';
import { deriveDefaultPhysicalDimensions, normalizeGlbBounds } from '../arPlacement';

export interface SceneSettingsFormValues {
  scale: number;
  rotation_x: number;
  rotation_y: number;
  rotation_z: number;
  placement_mode: PlacementMode;
  shadow_intensity: number;
  auto_rotate: boolean;
  camera_controls: boolean;
  animation_name: string;
  animation_autoplay: boolean;
  animation_loop: boolean;
  physicalWidth: string;
  physicalHeight: string;
  physicalDepth: string;
  arScaleMode: ArScaleMode;
}

function fromSettings(s: SceneSettings | null | undefined, animations: string[]): SceneSettingsFormValues {
  const cfg = s?.viewer_config ?? {};
  return {
    scale: s?.scale ?? 1,
    rotation_x: s?.rotation_x ?? 0,
    rotation_y: s?.rotation_y ?? 0,
    rotation_z: s?.rotation_z ?? 0,
    placement_mode: s?.placement_mode ?? 'floor',
    shadow_intensity: s?.shadow_intensity ?? 1,
    auto_rotate: s?.auto_rotate ?? true,
    camera_controls: s?.camera_controls ?? true,
    animation_name: s?.animation_name ?? animations[0] ?? '',
    animation_autoplay: s?.animation_autoplay ?? true,
    animation_loop: s?.animation_loop ?? true,
    physicalWidth: cfg.physicalWidth != null ? String(cfg.physicalWidth) : '',
    physicalHeight: cfg.physicalHeight != null ? String(cfg.physicalHeight) : '',
    physicalDepth: cfg.physicalDepth != null ? String(cfg.physicalDepth) : '',
    arScaleMode: cfg.arScaleMode === 'auto' ? 'auto' : 'fixed',
  };
}

export function SceneSettingsForm({
  settings,
  animationNames,
  modelBounds,
  busy,
  onChange,
  onSave,
}: {
  settings: SceneSettings | null | undefined;
  animationNames: string[];
  modelBounds?: unknown;
  busy?: boolean;
  onChange: (values: SceneSettingsFormValues) => void;
  onSave: (values: SceneSettingsFormValues) => void;
}) {
  const [values, setValues] = useState<SceneSettingsFormValues>(() =>
    fromSettings(settings, animationNames),
  );

  useEffect(() => {
    setValues(fromSettings(settings, animationNames));
  }, [settings, animationNames]);

  const patch = (partial: Partial<SceneSettingsFormValues>) => {
    setValues((prev) => {
      const next = { ...prev, ...partial };
      onChange(next);
      return next;
    });
  };

  const bounds = normalizeGlbBounds(modelBounds);
  const estimated = bounds ? deriveDefaultPhysicalDimensions(bounds) : null;

  const applyTestHeight = () => {
    patch({ physicalHeight: '0.30' });
  };

  return (
    <form
      className="scene-settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
      }}
    >
      <label className="dash-field">
        <span>Scale</span>
        <input
          type="number"
          min={0.01}
          step={0.01}
          value={values.scale}
          disabled={busy}
          onChange={(e) => patch({ scale: Number(e.target.value) })}
        />
      </label>
      <div className="scene-settings-row">
        <label className="dash-field">
          <span>Rot X°</span>
          <input
            type="number"
            step={1}
            value={values.rotation_x}
            disabled={busy}
            onChange={(e) => patch({ rotation_x: Number(e.target.value) })}
          />
        </label>
        <label className="dash-field">
          <span>Rot Y°</span>
          <input
            type="number"
            step={1}
            value={values.rotation_y}
            disabled={busy}
            onChange={(e) => patch({ rotation_y: Number(e.target.value) })}
          />
        </label>
        <label className="dash-field">
          <span>Rot Z°</span>
          <input
            type="number"
            step={1}
            value={values.rotation_z}
            disabled={busy}
            onChange={(e) => patch({ rotation_z: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="scene-settings-row">
        <label className="dash-field">
          <span>Real-world height (m)</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            placeholder={estimated ? String(estimated.height) : '0.30'}
            value={values.physicalHeight}
            disabled={busy}
            onChange={(e) => patch({ physicalHeight: e.target.value })}
          />
          <span className="dash-field-hint">
            Primary AR size control. Example test object: 0.30 m.
            {estimated && !values.physicalHeight.trim()
              ? ` Estimated from GLB: ${estimated.height.toFixed(2)} m tall (longest axis ~${estimated.targetLongestM} m).`
              : null}
          </span>
        </label>
        <div className="scene-settings-inline-actions">
          <button type="button" className="dash-button dash-button--small" disabled={busy} onClick={applyTestHeight}>
            Set test height (0.30 m)
          </button>
        </div>
      </div>
      <div className="scene-settings-row">
        <label className="dash-field">
          <span>Physical width (m)</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={values.physicalWidth}
            disabled={busy}
            onChange={(e) => patch({ physicalWidth: e.target.value })}
          />
        </label>
        <label className="dash-field">
          <span>Physical depth (m)</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={values.physicalDepth}
            disabled={busy}
            onChange={(e) => patch({ physicalDepth: e.target.value })}
          />
        </label>
      </div>
      <label className="dash-field">
        <span>AR user scaling</span>
        <select
          value={values.arScaleMode}
          disabled={busy}
          onChange={(e) => patch({ arScaleMode: e.target.value as ArScaleMode })}
        >
          {AR_SCALE_MODES.map((m) => (
            <option key={m} value={m}>
              {m === 'fixed' ? 'Fixed (recommended for anchoring tests)' : 'Auto (pinch to resize in AR)'}
            </option>
          ))}
        </select>
      </label>
      <label className="dash-field">
        <span>Placement mode</span>
        <select
          value={values.placement_mode}
          disabled={busy}
          onChange={(e) => patch({ placement_mode: e.target.value as PlacementMode })}
        >
          {PLACEMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="dash-field">
        <span>Shadow intensity</span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={values.shadow_intensity}
          disabled={busy}
          onChange={(e) => patch({ shadow_intensity: Number(e.target.value) })}
        />
      </label>
      <label className="dash-check">
        <input
          type="checkbox"
          checked={values.auto_rotate}
          disabled={busy}
          onChange={(e) => patch({ auto_rotate: e.target.checked })}
        />
        Auto-rotate
      </label>
      <label className="dash-check">
        <input
          type="checkbox"
          checked={values.camera_controls}
          disabled={busy}
          onChange={(e) => patch({ camera_controls: e.target.checked })}
        />
        Camera controls
      </label>
      {animationNames.length > 0 && (
        <>
          <label className="dash-field">
            <span>Animation</span>
            <select
              value={values.animation_name}
              disabled={busy}
              onChange={(e) => patch({ animation_name: e.target.value })}
            >
              <option value="">None</option>
              {animationNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="dash-check">
            <input
              type="checkbox"
              checked={values.animation_autoplay}
              disabled={busy}
              onChange={(e) => patch({ animation_autoplay: e.target.checked })}
            />
            Animation autoplay
          </label>
          <label className="dash-check">
            <input
              type="checkbox"
              checked={values.animation_loop}
              disabled={busy}
              onChange={(e) => patch({ animation_loop: e.target.checked })}
            />
            Animation loop
          </label>
        </>
      )}
      <button className="dash-button" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save scene settings'}
      </button>
    </form>
  );
}
