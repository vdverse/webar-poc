/** Minimal JSX typings for the CDN-loaded model-viewer custom element. */
import type { CSSProperties, DetailedHTMLProps, HTMLAttributes, Ref } from 'react';

type ModelViewerProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  ref?: Ref<HTMLElement>;
  src?: string;
  poster?: string;
  alt?: string;
  ar?: boolean | string;
  'ar-modes'?: string;
  'camera-controls'?: boolean | string;
  'auto-rotate'?: boolean | string;
  'shadow-intensity'?: string | number;
  'animation-name'?: string;
  autoplay?: boolean | string;
  scale?: string;
  orientation?: string;
  'ios-src'?: string;
  reveal?: string;
  loading?: string;
  class?: string;
  style?: CSSProperties;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerProps;
    }
  }
}

export {};
