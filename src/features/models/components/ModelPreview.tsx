import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { ensureModelViewerLoaded } from '../loadModelViewer';
import type { SceneSettings } from '../types';

export interface ModelPreviewProps {
  src: string | null;
  iosSrc?: string | null;
  alt: string;
  settings?: Partial<SceneSettings> | null;
  ar?: boolean;
  arModes?: string;
  className?: string;
  onLoad?: () => void;
  onError?: (message: string) => void;
}

type ModelViewerElement = HTMLElement & {
  src?: string;
};

export function ModelPreview({
  src,
  iosSrc,
  alt,
  settings,
  ar = false,
  arModes = 'webxr scene-viewer',
  className,
  onLoad,
  onError,
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

  const scale = settings?.scale ?? 1;
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
    />
  );
}
