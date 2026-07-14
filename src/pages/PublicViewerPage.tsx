import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

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

function detectSupport(): { webxrLikely: boolean; ios: boolean; android: boolean } {
  if (typeof navigator === 'undefined') {
    return { webxrLikely: false, ios: false, android: false };
  }
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const webxrLikely = 'xr' in navigator || android;
  return { webxrLikely, ios, android };
}

export default function PublicViewerPage() {
  const { publicSlug } = useParams<{ publicSlug: string }>();
  const [copied, setCopied] = useState(false);
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
  const arModes = snapshot.arModes || (hasUsdz ? 'webxr scene-viewer quick-look' : 'webxr scene-viewer');

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
        <ModelPreview
          className="pv-viewer"
          src={snapshot.glbPublicUrl}
          iosSrc={snapshot.usdzPublicUrl}
          alt={snapshot.title}
          settings={snapshotToSettings(snapshot)}
          ar
          arModes={arModes}
        />
      </div>

      <div className="pv-actions">
        <p className="pv-hint">
          Tap the AR glyph on the model (or “View in your space” in the viewer chrome) on a supported
          phone. No account required.
        </p>

        {support.ios && !hasUsdz && (
          <div className="pv-notice" role="note">
            iPhone AR (Quick Look) needs a USDZ file. This publication only has GLB, so you can still
            preview in 3D here — iPhone world placement is not available yet for this model.
          </div>
        )}

        {!support.ios && !support.android && !support.webxrLikely && (
          <div className="pv-notice" role="note">
            This device may not support markerless AR. You can still orbit the 3D preview, or open
            this link on an Android phone with ARCore for “View in your space”.
          </div>
        )}

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
