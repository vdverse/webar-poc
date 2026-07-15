import { useEffect, useRef, useState, type CSSProperties } from 'react';

import type { ArScaleMode } from '../types';
import { ensureModelViewerLoaded } from '../loadModelViewer';
import type { SceneSettings } from '../types';

export type ArPlacement = 'floor' | 'wall';

export interface ModelPreviewProps {
  src: string | null;
  iosSrc?: string | null;
  alt: string;
  settings?: Partial<SceneSettings> | null;
  /** Overrides settings.scale when set (e.g. publication effectiveScale). */
  viewerScale?: number;
  ar?: boolean;
  arModes?: string;
  arPlacement?: ArPlacement;
  arScaleMode?: ArScaleMode;
  className?: string;
  onLoad?: () => void;
  onError?: (message: string) => void;
  onArStatusChange?: (status: string, tracking?: string) => void;
}

type ModelViewerElement = HTMLElement & {
  src?: string;
  getAttribute?: (name: string) => string | null;
};

export function ModelPreview({
  src,
  iosSrc,
  alt,
  settings,
  viewerScale,
  ar = false,
  arModes = 'webxr scene-viewer',
  arPlacement = 'floor',
  arScaleMode = 'fixed',
  className,
  onLoad,
  onError,
  onArStatusChange,
}: ModelPreviewProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const ref = useRef<ModelViewerElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureModelViewerLoaded()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : '3D viewer failed to load';
          setFailed(msg);
          onError?.(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const onMvLoad = () => onLoad?.();
    const onMvError = () => {
      const msg = 'The 3D model failed to load.';
      setFailed(msg);
      onError?.(msg);
    };
    el.addEventListener('load', onMvLoad);
    el.addEventListener('error', onMvError);
    return () => {
      el.removeEventListener('load', onMvLoad);
      el.removeEventListener('error', onMvError);
    };
  }, [ready, src, onLoad, onError]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready || !ar || !onArStatusChange) return;

    const emit = () => {
      const status = el.getAttribute?.('ar-status') ?? 'unknown';
      const tracking = el.getAttribute?.('ar-tracking') ?? undefined;
      onArStatusChange(status, tracking);
    };

    el.addEventListener('ar-status', emit);
    el.addEventListener('ar-tracking', emit);
    emit();
    return () => {
      el.removeEventListener('ar-status', emit);
      el.removeEventListener('ar-tracking', emit);
    };
  }, [ar, ready, onArStatusChange, src]);

  if (failed) {
    return (
      <div className={className} role="alert" style={{ padding: 24 }}>
        {failed}
      </div>
    );
  }

  if (!ready || !src) {
    return (
      <div className={className} aria-busy="true" style={{ padding: 24 }}>
        {src ? 'Loading 3D viewer…' : 'No model yet.'}
      </div>
    );
  }

  const scale = viewerScale ?? settings?.scale ?? 1;
  const rx = settings?.rotation_x ?? 0;
  const ry = settings?.rotation_y ?? 0;
  const rz = settings?.rotation_z ?? 0;
  const orientation = `${rx}deg ${ry}deg ${rz}deg`;
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    minHeight: 320,
    background: '#1a1a1a',
  };

  return (
    <model-viewer
      ref={ref as never}
      class={className}
      src={src}
      ios-src={iosSrc || undefined}
      alt={alt}
      ar={ar || undefined}
      ar-modes={ar ? arModes : undefined}
      ar-placement={ar ? arPlacement : undefined}
      ar-scale={ar ? arScaleMode : undefined}
      camera-controls={settings?.camera_controls !== false ? true : undefined}
      auto-rotate={settings?.auto_rotate ? true : undefined}
      shadow-intensity={String(settings?.shadow_intensity ?? 1)}
      animation-name={settings?.animation_name || undefined}
      autoplay={settings?.animation_autoplay ? true : undefined}
      scale={`${scale} ${scale} ${scale}`}
      orientation={orientation}
      style={style}
      reveal="auto"
      loading="eager"
      interaction-prompt="none"
    />
  );
}
