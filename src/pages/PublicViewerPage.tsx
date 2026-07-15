import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  AR_MODES_ORDERED,
  computeModelViewerScale,
  describeArStatus,
  formatArDiagnostics,
  mapPlacementModeToArPlacement,
  normalizeGlbBounds,
  resolveArScaleMode,
} from '../features/models/arPlacement';
import { ModelPreview } from '../features/models/components/ModelPreview';
import { isSupabaseConfigured } from '../lib/env';
import { getActivePublicationBySlug } from '../features/models/publishService';
import type { PublicationSnapshot, SceneSettings } from '../features/models/types';
import './public-viewer.css';

function snapshotToSettings(snapshot: PublicationSnapshot): Partial<SceneSettings> {
  return {
    scale: snapshot.scene.scale,
    rotation_x: snapshot.scene.rotationX,
    rotation_y: snapshot.scene.rotationY,
    rotation_z: snapshot.scene.rotationZ,
    shadow_intensity: snapshot.scene.shadowIntensity,
    auto_rotate: snapshot.scene.autoRotate,
    camera_controls: snapshot.scene.cameraControls,
    animation_name: snapshot.scene.animationName,
    animation_autoplay: snapshot.scene.animationAutoplay,
    animation_loop: snapshot.scene.animationLoop,
  };
}

function resolveViewerScale(snapshot: PublicationSnapshot): number {
  if (typeof snapshot.scene.effectiveScale === 'number' && snapshot.scene.effectiveScale > 0) {
    return snapshot.scene.effectiveScale;
  }
  const bounds = normalizeGlbBounds(snapshot.modelBounds);
  return computeModelViewerScale({
    sceneScale: snapshot.scene.scale,
    bounds,
    physicalWidth: snapshot.scene.physicalWidth,
    physicalHeight: snapshot.scene.physicalHeight,
    physicalDepth: snapshot.scene.physicalDepth,
  }).scale;
}

function detectSupport(): { webxrLikely: boolean; ios: boolean; android: boolean } {
  if (typeof navigator === 'undefined') {
    return { webxrLikely: false, ios: false, android: false };
  }
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const webxrLikely = 'xr' in navigator || android;
  return { webxrLikely, ios, android };
}


export default function PublicViewerPage() {
  const { publicSlug } = useParams<{ publicSlug: string }>();
  const [copied, setCopied] = useState(false);
  const [arStatus, setArStatus] = useState<string>('not-presenting');
  const [arTracking, setArTracking] = useState<string | undefined>();
  const support = useMemo(() => detectSupport(), []);

  const pub = useQuery({
    queryKey: ['public-publication', publicSlug],
    queryFn: () => getActivePublicationBySlug(publicSlug!),
    enabled: Boolean(publicSlug) && isSupabaseConfigured,
  });

  if (!isSupabaseConfigured) {
    return (
      <div className="pv-page">
        <div className="pv-card" role="alert">
          <h1>Viewer unavailable</h1>
          <p>This deployment has no Supabase configuration, so public experiences cannot load.</p>
          <Link to="/">Home</Link>
        </div>
      </div>
    );
  }

  if (pub.isPending) {
    return (
      <div className="pv-page">
        <div className="pv-card" aria-busy="true">
          Loading experience…
        </div>
      </div>
    );
  }

  if (pub.isError) {
    return (
      <div className="pv-page">
        <div className="pv-card" role="alert">
          <h1>Something went wrong</h1>
          <p>{pub.error instanceof Error ? pub.error.message : 'Could not load this experience.'}</p>
          <Link to="/">Home</Link>
        </div>
      </div>
    );
  }

  if (!pub.data) {
    return (
      <div className="pv-page">
        <div className="pv-card" role="status">
          <h1>Experience not found</h1>
          <p>This link is missing, expired, or unpublished.</p>
          <Link to="/">Home</Link>
        </div>
      </div>
    );
  }

  const snapshot = pub.data.snapshot as PublicationSnapshot;
  const hasUsdz = Boolean(snapshot.usdzPublicUrl);
  const arModes = snapshot.arModes || (hasUsdz ? AR_MODES_ORDERED : 'webxr scene-viewer');
  const arPlacement = mapPlacementModeToArPlacement(snapshot.scene.placementMode);
  const arScaleMode = resolveArScaleMode(snapshot.scene.arScaleMode);
  const viewerScale = resolveViewerScale(snapshot);
  const physicalSizeEstimated = snapshot.scene.physicalSizeEstimated ?? false;

  if (import.meta.env.DEV && arStatus !== 'not-presenting') {
    console.info(
      '[public-viewer ar]',
      formatArDiagnostics({
        arPlacement,
        arScaleMode,
        arModes,
        effectiveScale: viewerScale,
        physicalSizeEstimated,
        arStatus,
        arTracking,
      }),
    );
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: snapshot.title,
        text: snapshot.description ?? snapshot.title,
        url: window.location.href,
      });
    } else {
      await copyLink();
    }
  };

  return (
    <div className="pv-page">
      <header className="pv-header">
        <h1>{snapshot.title}</h1>
        {snapshot.description && <p>{snapshot.description}</p>}
      </header>

      <div className="pv-stage">
        <div className="pv-ar-guide" role="note">
          <strong>Before AR:</strong> Move your phone slowly to scan the floor or table. When the
          placement marker appears, tap to place the object. Then walk around it.
        </div>
        <ModelPreview
          className="pv-viewer"
          src={snapshot.glbPublicUrl}
          iosSrc={snapshot.usdzPublicUrl}
          alt={snapshot.title}
          settings={snapshotToSettings(snapshot)}
          viewerScale={viewerScale}
          ar
          arModes={arModes}
          arPlacement={arPlacement}
          arScaleMode={arScaleMode}
          onArStatusChange={(status, tracking) => {
            setArStatus(status);
            setArTracking(tracking);
          }}
        />
        {(import.meta.env.DEV || arStatus !== 'not-presenting') && (
          <p className="pv-ar-diagnostics" aria-live="polite">
            AR: {describeArStatus(arStatus)}
            {import.meta.env.DEV
              ? ` · ${formatArDiagnostics({
                  arPlacement,
                  arScaleMode,
                  arModes,
                  effectiveScale: viewerScale,
                  physicalSizeEstimated,
                  arStatus,
                  arTracking,
                })}`
              : null}
          </p>
        )}
      </div>

      <div className="pv-actions">
        <p className="pv-hint">
          Tap <strong>View in your space</strong> on a supported phone. No account required. After
          placement, the object should stay fixed while you walk around it.
        </p>

        {physicalSizeEstimated && (
          <div className="pv-notice" role="note">
            Real-world size is estimated from the model file (~
            {snapshot.scene.physicalHeight?.toFixed(2) ?? '0.35'} m tall). Republish after setting
            Real-world height in the studio for precise AR sizing.
          </div>
        )}

        {support.ios && !hasUsdz && (
          <div className="pv-notice" role="note">
            iPhone AR (Quick Look) needs a USDZ file. This publication only has GLB, so you can still
            preview in 3D here — iPhone world placement is not available yet for this model.
          </div>
        )}

        {support.android && !support.ios && (
          <div className="pv-notice" role="note">
            On Android, Chrome tries <strong>WebXR</strong> first for tap-to-place on detected
            surfaces. If that is unavailable, Google <strong>Scene Viewer</strong> opens instead.
            Scene Viewer <strong>AR</strong> mode anchors to the floor; <strong>Object</strong> mode
            is a 3D preview that moves with the camera and is not world-anchored.
          </div>
        )}

        {arStatus === 'failed' && (
          <div className="pv-notice" role="alert">
            AR could not start. Try good lighting, a textured non-reflective surface, slow phone
            movement, and an updated version of Android Chrome with Google Play Services for AR.
          </div>
        )}

        {!support.ios && !support.android && !support.webxrLikely && (
          <div className="pv-notice" role="note">
            This device may not support markerless world anchoring. You can still orbit the 3D preview,
            or open this link on an Android phone with ARCore for surface placement.
          </div>
        )}

        <details className="pv-troubleshooting">
          <summary>AR troubleshooting</summary>
          <ul>
            <li>Use bright, even lighting.</li>
            <li>Scan a textured, non-reflective floor or table.</li>
            <li>Move the phone slowly until a placement reticle appears.</li>
            <li>Tap once to place — the model should not follow the camera afterward.</li>
            <li>Keep the model at a reasonable scale (about 0.3–0.5 m for small objects).</li>
            <li>Update Google Play Services for AR and use current Android Chrome.</li>
            <li>
              WebXR (Chrome) supports tap-to-place on detected surfaces. Scene Viewer AR mode does
              the same; Object-only mode does not anchor to the room.
            </li>
          </ul>
        </details>

        <div className="pv-buttons">
          <button type="button" className="pv-button" onClick={() => void share()}>
            Share
          </button>
          <button type="button" className="pv-button pv-button--secondary" onClick={() => void copyLink()}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
