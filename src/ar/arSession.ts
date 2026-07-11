import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ArErrorCode =
  | 'camera-denied'
  | 'no-camera'
  | 'webgl-unavailable'
  | 'target-load-failed'
  | 'model-load-failed'
  | 'ar-start-failed';

export class ArError extends Error {
  code: ArErrorCode;
  constructor(code: ArErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ArSessionCallbacks {
  onTargetFound: () => void;
  onTargetLost: () => void;
}

export interface ArSession {
  /** Idempotent. Stops tracking, camera tracks, animation loop; disposes GPU resources. */
  destroy: () => void;
}

const TARGET_MIND_URL = `${import.meta.env.BASE_URL}ar-demo/target.mind`;
const MODEL_URL = `${import.meta.env.BASE_URL}ar-demo/model.glb`;

/** How much of the target's width the model should occupy. */
const MODEL_FIT = 0.6;

function assertWebGl(): void {
  const canvas = document.createElement('canvas');
  // getContext can either return null or throw when a context is unavailable.
  const tryContext = (id: string): RenderingContext | null => {
    try {
      return canvas.getContext(id);
    } catch {
      return null;
    }
  };
  const gl =
    tryContext('webgl2') ?? tryContext('webgl') ?? tryContext('experimental-webgl');
  if (!gl) {
    throw new ArError(
      'webgl-unavailable',
      'WebGL is not available in this browser, so 3D content cannot be rendered. Try updating the browser or enabling hardware acceleration.',
    );
  }
}

/**
 * Request the rear camera once so permission errors are precise, then release
 * it. MindAR's own start() rejects with `undefined` on getUserMedia failure
 * (verified in the installed bundle), which is why this probe exists. The
 * browser caches the grant, so MindAR's follow-up request shows no second
 * prompt.
 */
async function probeCamera(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new ArError(
      'no-camera',
      'Camera access is not supported here. Use a modern mobile browser over HTTPS.',
    );
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    stream.getTracks().forEach((t) => t.stop());
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new ArError(
        'camera-denied',
        'Camera permission was denied. Allow camera access for this site in the browser settings, then try again.',
      );
    }
    if (
      name === 'NotFoundError' ||
      name === 'DevicesNotFoundError' ||
      name === 'OverconstrainedError'
    ) {
      throw new ArError(
        'no-camera',
        'No usable camera was found on this device.',
      );
    }
    throw new ArError(
      'ar-start-failed',
      `The camera could not be started (${name || 'unknown error'}).`,
    );
  }
}

/** Fetch the compiled target up front so a missing/broken file is reported precisely. */
async function assertTargetLoadable(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(TARGET_MIND_URL);
  } catch {
    throw new ArError(
      'target-load-failed',
      `The tracking target (${TARGET_MIND_URL}) could not be fetched. Check the network connection.`,
    );
  }
  if (!res.ok) {
    throw new ArError(
      'target-load-failed',
      `The tracking target (${TARGET_MIND_URL}) returned HTTP ${res.status}. Run \`npm run compile:target\` and rebuild.`,
    );
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 1000) {
    throw new ArError(
      'target-load-failed',
      'The tracking target file is too small to be a compiled .mind file. Recompile it.',
    );
  }
}

interface LoadedModel {
  root: THREE.Group;
  animations: THREE.AnimationClip[];
}

async function loadModel(): Promise<LoadedModel> {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(MODEL_URL);
    return { root: gltf.scene, animations: gltf.animations };
  } catch {
    throw new ArError(
      'model-load-failed',
      `The 3D model (${MODEL_URL}) could not be loaded. Confirm the file exists and is a valid glTF binary.`,
    );
  }
}

/**
 * Scale the model so its largest dimension spans MODEL_FIT of the target
 * width (the target is 1 unit wide in MindAR anchor space), centre it on the
 * target, and stand it "out of" the printed page (model +Y -> anchor +Z).
 * Exported for unit testing.
 */
export function fitModelToAnchor(root: THREE.Group): THREE.Group {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? MODEL_FIT / maxDim : 1;

  // Centre X/Z on the target; rest the bounding-box bottom on the page.
  root.position.set(
    -center.x * scale,
    -box.min.y * scale,
    -center.z * scale,
  );
  root.scale.setScalar(scale);

  const wrapper = new THREE.Group();
  wrapper.rotation.x = Math.PI / 2; // model +Y becomes anchor +Z
  wrapper.add(root);
  return wrapper;
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const materials: THREE.Material[] = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      materials.forEach(disposeMaterial);
    }
  });
}

/**
 * Start a full AR session. Resolves once tracking is running. Throws ArError
 * with a specific code for every known failure mode. If the returned
 * session's destroy() is called (or the passed signal aborts) at any point —
 * including mid-startup — everything acquired so far is released.
 */
export async function startArSession(
  container: HTMLElement,
  callbacks: ArSessionCallbacks,
  signal: { aborted: boolean },
): Promise<ArSession> {
  assertWebGl();
  await probeCamera();
  if (signal.aborted) return { destroy: () => undefined };
  await assertTargetLoadable();
  if (signal.aborted) return { destroy: () => undefined };
  const model = await loadModel();
  if (signal.aborted) {
    disposeObjectTree(model.root);
    return { destroy: () => undefined };
  }

  const mindar = new MindARThree({
    container,
    imageTargetSrc: TARGET_MIND_URL,
    maxTrack: 1,
    // The PoC renders its own status UI.
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
  });

  const anchor = mindar.addAnchor(0);
  anchor.onTargetFound = callbacks.onTargetFound;
  anchor.onTargetLost = callbacks.onTargetLost;

  const wrapper = fitModelToAnchor(model.root);
  anchor.group.add(wrapper);

  const mixer = new THREE.AnimationMixer(model.root);
  if (model.animations.length > 0) {
    mixer.clipAction(model.animations[0]).play();
  }
  const clock = new THREE.Clock();

  let started = false;
  let destroyed = false;

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;

    // 1. Stop the animation loop.
    mindar.renderer.setAnimationLoop(null);

    // 2. Stop tracking and camera tracks. mindar.stop() throws if start()
    //    never completed (controller is undefined), so fall back to manual
    //    track cleanup in that case.
    try {
      if (started) {
        mindar.stop();
      } else {
        throw new Error('not started');
      }
    } catch {
      const video = mindar.video;
      const src = video?.srcObject;
      if (src instanceof MediaStream) {
        src.getTracks().forEach((t) => t.stop());
      }
      video?.remove();
    }
    // Neutralise the resize listener MindAR leaks on window (it early-returns
    // when video is falsy). See README known limitations.
    mindar.video = null;

    // 3. Dispose animation state.
    mixer.stopAllAction();
    mixer.uncacheRoot(model.root);

    // 4. Dispose geometries, materials and textures.
    disposeObjectTree(mindar.scene);

    // 5. Dispose the renderer and remove the DOM MindAR appended.
    mindar.renderer.dispose();
    mindar.renderer.domElement.remove();
    mindar.cssRenderer.domElement.remove();
  };

  try {
    await mindar.start();
    started = true;
  } catch (err) {
    destroy();
    throw new ArError(
      'ar-start-failed',
      `AR tracking failed to start${err instanceof Error ? `: ${err.message}` : ''}. Reload the page and try again.`,
    );
  }

  if (signal.aborted) {
    destroy();
    return { destroy };
  }

  mindar.renderer.setAnimationLoop(() => {
    mixer.update(clock.getDelta());
    mindar.renderer.render(mindar.scene, mindar.camera);
  });

  return { destroy };
}
