/**
 * Types for mind-ar@1.2.5's three.js bundle.
 *
 * mind-ar ships no TypeScript types. This declaration was written by
 * inspecting node_modules/mind-ar/dist/mindar-image-three.prod.js — the
 * shapes below mirror the actual installed code, not the docs:
 *
 * - constructor options object (container, imageTargetSrc, maxTrack, ui*,
 *   filter*, *Tolerance, *DeviceId)
 * - start(): Promise<void> — NOTE: rejects with `undefined` on getUserMedia
 *   failure, so callers must probe the camera themselves for useful errors
 * - stop(): throws if called before start() succeeded (this.controller is
 *   undefined), so callers must guard
 * - addAnchor(targetIndex) returns a mutable anchor record whose
 *   onTargetFound/onTargetLost/onTargetUpdate fields are assigned directly
 * - no built-in render loop: callers drive renderer.setAnimationLoop
 * - the constructor appends renderer.domElement and cssRenderer.domElement
 *   to the container and registers a window resize listener it never removes
 */
declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import type {
    Group,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
  } from 'three';

  export interface MindARAnchor {
    group: Group;
    targetIndex: number;
    onTargetFound: (() => void) | null;
    onTargetLost: (() => void) | null;
    onTargetUpdate: (() => void) | null;
    css: boolean;
    visible: boolean;
  }

  export interface MindARThreeOptions {
    container: HTMLElement;
    imageTargetSrc: string;
    maxTrack?: number;
    uiLoading?: 'yes' | 'no';
    uiScanning?: 'yes' | 'no';
    uiError?: 'yes' | 'no';
    filterMinCF?: number | null;
    filterBeta?: number | null;
    warmupTolerance?: number | null;
    missTolerance?: number | null;
    userDeviceId?: string | null;
    environmentDeviceId?: string | null;
  }

  export class MindARThree {
    constructor(options: MindARThreeOptions);
    container: HTMLElement;
    scene: Scene;
    cssScene: Scene;
    camera: PerspectiveCamera;
    renderer: WebGLRenderer;
    cssRenderer: { domElement: HTMLElement };
    /** Created inside start(); undefined before that. */
    video?: HTMLVideoElement | null;
    anchors: MindARAnchor[];
    start(): Promise<void>;
    stop(): void;
    switchCamera(): void;
    addAnchor(targetIndex: number): MindARAnchor;
    addCSSAnchor(targetIndex: number): MindARAnchor;
    resize(): void;
  }
}
