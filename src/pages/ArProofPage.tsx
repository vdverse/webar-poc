import { useEffect, useRef, useState } from 'react';

import {
  ArError,
  startArSession,
  type ArErrorCode,
  type ArSession,
} from '../ar/arSession';
import './ar-proof.css';

type Phase =
  | { name: 'idle' }
  | { name: 'starting' }
  | { name: 'scanning' }
  | { name: 'found' }
  | { name: 'error'; code: ArErrorCode; message: string };

const ERROR_TITLES: Record<ArErrorCode, string> = {
  'camera-denied': 'Camera permission denied',
  'no-camera': 'No camera available',
  'webgl-unavailable': 'WebGL unavailable',
  'target-load-failed': 'Tracking target failed to load',
  'model-load-failed': '3D model failed to load',
  'ar-start-failed': 'AR failed to start',
};

export default function ArProofPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ArSession | null>(null);
  const abortRef = useRef({ aborted: false });
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });

  // Route exit / unmount: stop camera tracks, animation frames, dispose GPU
  // resources. Also abort a start that is still in flight. A fresh signal is
  // created per start attempt so StrictMode's dev-only mount/unmount cycle
  // cannot leave a permanently aborted flag behind.
  useEffect(() => {
    return () => {
      abortRef.current.aborted = true;
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, []);

  const handleStart = async () => {
    const container = containerRef.current;
    if (!container || sessionRef.current || phase.name === 'starting') return;
    const signal = { aborted: false };
    abortRef.current = signal;
    setPhase({ name: 'starting' });
    try {
      const session = await startArSession(
        container,
        {
          onTargetFound: () => setPhase({ name: 'found' }),
          onTargetLost: () => setPhase({ name: 'scanning' }),
        },
        signal,
      );
      if (signal.aborted) {
        session.destroy();
        return;
      }
      sessionRef.current = session;
      setPhase({ name: 'scanning' });
    } catch (err) {
      if (signal.aborted) return;
      if (err instanceof ArError) {
        setPhase({ name: 'error', code: err.code, message: err.message });
      } else {
        setPhase({
          name: 'error',
          code: 'ar-start-failed',
          message: 'An unexpected error occurred while starting AR.',
        });
      }
    }
  };

  const handleStop = () => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setPhase({ name: 'idle' });
  };

  return (
    <div className="ar-page">
      <div
        ref={containerRef}
        className="ar-container"
        data-testid="ar-container"
      />

      {phase.name === 'idle' && (
        <div className="ar-overlay ar-overlay--center">
          <h1>WebAR proof of concept</h1>
          <p>
            Point this device at the printed target image and an animated 3D
            model will appear on it. The camera turns on only after you press
            Start.
          </p>
          <button className="ar-button" onClick={handleStart}>
            Start AR
          </button>
          <p className="ar-hint">
            Built for a phone in portrait. On a desktop without a rear camera
            you will see an explanatory error instead of tracking.
          </p>
        </div>
      )}

      {phase.name === 'starting' && (
        <div className="ar-overlay ar-overlay--center" role="status">
          <p>Starting camera and loading tracking data…</p>
        </div>
      )}

      {phase.name === 'scanning' && (
        <div className="ar-status" role="status">
          Point your camera at the target
        </div>
      )}

      {phase.name === 'found' && (
        <div className="ar-status ar-status--found" role="status">
          Target found
        </div>
      )}

      {phase.name === 'error' && (
        <div className="ar-overlay ar-overlay--center" role="alert">
          <h1>{ERROR_TITLES[phase.code]}</h1>
          <p>{phase.message}</p>
          <button className="ar-button" onClick={() => setPhase({ name: 'idle' })}>
            Back
          </button>
        </div>
      )}

      {(phase.name === 'scanning' || phase.name === 'found') && (
        <button className="ar-stop" onClick={handleStop}>
          Stop
        </button>
      )}
    </div>
  );
}
