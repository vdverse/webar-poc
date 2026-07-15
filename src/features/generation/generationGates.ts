/**
 * Pure generation gates + checklist (unit-tested).
 * Does not call providers; does not invent progress.
 */

import type { SourceMethod } from '../projects/types';
import type { GenerationJob, GenerationJobStatus } from './types';
import { isActiveGenerationStatus } from './types';

export const GENERATION_CHECKLIST = [
  { id: 'fully-visible', label: 'Object is fully visible in every photo' },
  { id: 'no-crop', label: 'No major cropping of important parts' },
  { id: 'lighting', label: 'Enough even lighting (avoid heavy shadows)' },
  { id: 'blur', label: 'Minimal motion blur' },
  { id: 'consistent', label: 'Same object across all photos' },
  { id: 'angles', label: 'Useful angle coverage (multi-view)' },
] as const;

export type GenerationGateReason =
  | 'not-photo-project'
  | 'project-unsaved'
  | 'images-incomplete'
  | 'images-uploading'
  | 'active-job'
  | 'provider-unavailable'
  | 'ok';

export interface GenerationGateInput {
  sourceMethod: SourceMethod | null;
  wizardStage: string | null;
  imageCount: number;
  imagesUploading: boolean;
  activeJob: GenerationJob | null;
  /** False when Edge Function reports provider-not-configured or env gate. */
  providerConfigured: boolean | null;
}

export function evaluateGenerateGate(input: GenerationGateInput): {
  canGenerate: boolean;
  reason: GenerationGateReason;
  message: string;
} {
  if (input.sourceMethod !== 'single_image' && input.sourceMethod !== 'multi_view') {
    return {
      canGenerate: false,
      reason: 'not-photo-project',
      message: 'Generation is only for single-image or multi-view projects. Upload a GLB instead.',
    };
  }
  if (input.wizardStage !== 'saved' && input.wizardStage !== 'review') {
    return {
      canGenerate: false,
      reason: 'project-unsaved',
      message: 'Save the project after uploading photos before generating.',
    };
  }
  const min = input.sourceMethod === 'multi_view' ? 2 : 1;
  const max = input.sourceMethod === 'multi_view' ? 12 : 1;
  if (input.imageCount < min || input.imageCount > max) {
    return {
      canGenerate: false,
      reason: 'images-incomplete',
      message:
        input.sourceMethod === 'single_image'
          ? 'Upload exactly one JPEG, PNG or WebP image first.'
          : `Upload between ${min} and ${max} photos with useful angle coverage.`,
    };
  }
  if (input.imagesUploading) {
    return {
      canGenerate: false,
      reason: 'images-uploading',
      message: 'Wait for all photos to finish uploading.',
    };
  }
  if (input.activeJob && isActiveGenerationStatus(input.activeJob.status)) {
    return {
      canGenerate: false,
      reason: 'active-job',
      message: 'A generation job is already in progress for this project.',
    };
  }
  if (input.providerConfigured === false) {
    return {
      canGenerate: false,
      reason: 'provider-unavailable',
      message:
        'Image-to-3D is not configured on the server yet. Direct GLB upload still works.',
    };
  }
  return {
    canGenerate: true,
    reason: 'ok',
    message: 'Ready to generate a 3D model from your photos.',
  };
}

export function mapStatusLabel(status: GenerationJobStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'submitted':
    case 'uploading':
      return 'Submitted';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
}

export function nextActionForError(code: string | null | undefined): string {
  switch (code) {
    case 'provider-not-configured':
      return 'Ask an admin to configure IMAGE_TO_3D_PROVIDER and IMAGE_TO_3D_API_KEY, or upload a GLB.';
    case 'missing-images':
    case 'invalid-images':
      return 'Fix your source photos, then try again.';
    case 'duplicate-active-job':
      return 'Open the current job and wait, or cancel it if stuck.';
    case 'entitlement-exhausted':
      return 'Development generation limit reached. Upload a GLB or wait for credits.';
    case 'provider-rate-limit':
    case 'provider-quota-exceeded':
      return 'Wait and retry later, or upload an existing GLB.';
    case 'provider-generation-failed':
    case 'invalid-glb':
      return 'Try different photos (better lighting/angles) or upload a GLB.';
    case 'cancelled':
      return 'You can start a new generation when ready.';
    default:
      return 'Retry generation, or use Upload an existing GLB as a fallback.';
  }
}

export type WizardPrimaryActionKind =
  | 'generate'
  | 'view-progress'
  | 'open-studio'
  | 'retry'
  | 'blocked';

export interface WizardPrimaryAction {
  kind: WizardPrimaryActionKind;
  /** Accessible / button label */
  label: string;
  /** When set, render as a Link; when null, render disabled. */
  to: string | null;
  supportingCopy: string;
  /** Shown when kind is blocked */
  blockedReason?: string;
}

/**
 * Primary CTA on the wizard “saved” step for photo projects.
 * Navigates to /generate or /studio — never starts a paid Meshy job itself.
 */
export function resolveWizardPrimaryAction(input: {
  projectId: string;
  projectStatus: string | null | undefined;
  sourceMethod: SourceMethod | null;
  wizardStage: string | null;
  imageCount: number;
  imagesUploading?: boolean;
  jobStatus: GenerationJobStatus | null | undefined;
  hasGeneratedModel: boolean;
}): WizardPrimaryAction {
  const generatePath = `/dashboard/projects/${input.projectId}/generate`;
  const studioPath = `/dashboard/projects/${input.projectId}/studio`;

  const jobActive =
    input.jobStatus != null && isActiveGenerationStatus(input.jobStatus);
  const projectGenerating = input.projectStatus === 'generating';
  if (jobActive || projectGenerating) {
    return {
      kind: 'view-progress',
      label: 'View generation progress',
      to: generatePath,
      supportingCopy: 'Generation is in progress. Status continues on the generation page.',
    };
  }

  if (input.jobStatus === 'failed') {
    return {
      kind: 'retry',
      label: 'Retry generation',
      to: generatePath,
      supportingCopy: 'The last generation failed. Open the generation page to retry with the same photos.',
    };
  }

  const readyInStudio =
    input.hasGeneratedModel ||
    input.jobStatus === 'completed' ||
    input.projectStatus === 'generated' ||
    input.projectStatus === 'published' ||
    input.projectStatus === 'editing';

  if (readyInStudio) {
    return {
      kind: 'open-studio',
      label: 'Open GLB Studio',
      to: studioPath,
      supportingCopy:
        'Your 3D model is ready. Open the Studio to preview, adjust and publish it.',
    };
  }

  const gate = evaluateGenerateGate({
    sourceMethod: input.sourceMethod,
    wizardStage: input.wizardStage,
    imageCount: input.imageCount,
    imagesUploading: Boolean(input.imagesUploading),
    activeJob: null,
    providerConfigured: null,
  });

  if (!gate.canGenerate) {
    return {
      kind: 'blocked',
      label: 'Generate 3D model',
      to: null,
      supportingCopy:
        'Your photos stay private. When requirements are met, continue to generation.',
      blockedReason: gate.message,
    };
  }

  return {
    kind: 'generate',
    label: 'Generate 3D model',
    to: generatePath,
    supportingCopy:
      'Your photos are ready. Generate a 3D model, then open the Studio to adjust and publish it.',
  };
}
