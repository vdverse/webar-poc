import { describe, expect, it } from 'vitest';

import {
  evaluateGenerateGate,
  nextActionForError,
  resolveWizardPrimaryAction,
} from './generationGates';
import { canShowNumericProgress, isActiveGenerationStatus } from './types';
import type { GenerationJob } from './types';

const baseJob = (status: GenerationJob['status']): GenerationJob => ({
  id: 'j1',
  project_id: 'p1',
  status,
  stage: 'Processing',
  progress: 40,
  provider: 'mock',
  input_mode: 'single_image',
  safe_error_code: null,
  safe_error_message: null,
  created_at: '2026-07-16T00:00:00Z',
  started_at: null,
  completed_at: null,
  cancelled_at: null,
});

describe('evaluateGenerateGate', () => {
  it('blocks non-photo projects', () => {
    const r = evaluateGenerateGate({
      sourceMethod: 'glb_upload',
      wizardStage: 'saved',
      imageCount: 0,
      imagesUploading: false,
      activeJob: null,
      providerConfigured: true,
    });
    expect(r.canGenerate).toBe(false);
    expect(r.reason).toBe('not-photo-project');
  });

  it('requires saved/review stage and exact image counts', () => {
    expect(
      evaluateGenerateGate({
        sourceMethod: 'single_image',
        wizardStage: 'capture',
        imageCount: 1,
        imagesUploading: false,
        activeJob: null,
        providerConfigured: true,
      }).reason,
    ).toBe('project-unsaved');

    expect(
      evaluateGenerateGate({
        sourceMethod: 'single_image',
        wizardStage: 'saved',
        imageCount: 0,
        imagesUploading: false,
        activeJob: null,
        providerConfigured: true,
      }).reason,
    ).toBe('images-incomplete');

    expect(
      evaluateGenerateGate({
        sourceMethod: 'multi_view',
        wizardStage: 'saved',
        imageCount: 1,
        imagesUploading: false,
        activeJob: null,
        providerConfigured: true,
      }).reason,
    ).toBe('images-incomplete');
  });

  it('blocks active jobs and unconfigured provider', () => {
    expect(
      evaluateGenerateGate({
        sourceMethod: 'single_image',
        wizardStage: 'saved',
        imageCount: 1,
        imagesUploading: false,
        activeJob: baseJob('processing'),
        providerConfigured: true,
      }).reason,
    ).toBe('active-job');

    expect(
      evaluateGenerateGate({
        sourceMethod: 'single_image',
        wizardStage: 'saved',
        imageCount: 1,
        imagesUploading: false,
        activeJob: null,
        providerConfigured: false,
      }).reason,
    ).toBe('provider-unavailable');
  });

  it('allows a ready photo project', () => {
    const r = evaluateGenerateGate({
      sourceMethod: 'single_image',
      wizardStage: 'saved',
      imageCount: 1,
      imagesUploading: false,
      activeJob: null,
      providerConfigured: null,
    });
    expect(r.canGenerate).toBe(true);
    expect(r.reason).toBe('ok');
  });
});

describe('progress honesty', () => {
  it('does not show 0% or 100% as inventable mid-progress', () => {
    expect(canShowNumericProgress(0)).toBe(false);
    expect(canShowNumericProgress(100)).toBe(false);
    expect(canShowNumericProgress(42)).toBe(true);
  });

  it('classifies active statuses', () => {
    expect(isActiveGenerationStatus('processing')).toBe(true);
    expect(isActiveGenerationStatus('completed')).toBe(false);
  });
});

describe('nextActionForError', () => {
  it('maps known codes to next actions', () => {
    expect(nextActionForError('provider-not-configured')).toMatch(/IMAGE_TO_3D/);
    expect(nextActionForError('duplicate-active-job')).toMatch(/cancel/i);
  });
});

describe('resolveWizardPrimaryAction', () => {
  const base = {
    projectId: 'p1',
    projectStatus: 'draft' as string | null,
    sourceMethod: 'single_image' as const,
    wizardStage: 'saved',
    imageCount: 1,
    jobStatus: null as null | 'processing' | 'completed' | 'failed',
    hasGeneratedModel: false,
  };

  it('links Generate for a ready single-image project', () => {
    const a = resolveWizardPrimaryAction(base);
    expect(a.kind).toBe('generate');
    expect(a.label).toBe('Generate 3D model');
    expect(a.to).toBe('/dashboard/projects/p1/generate');
    expect(a.supportingCopy).toMatch(/photos are ready/i);
  });

  it('links Generate for multi-view when minimum images exist', () => {
    const a = resolveWizardPrimaryAction({
      ...base,
      sourceMethod: 'multi_view',
      imageCount: 2,
    });
    expect(a.kind).toBe('generate');
    expect(a.to).toContain('/generate');
  });

  it('blocks Generate when images are missing with a clear reason', () => {
    const a = resolveWizardPrimaryAction({ ...base, imageCount: 0 });
    expect(a.kind).toBe('blocked');
    expect(a.to).toBeNull();
    expect(a.blockedReason).toMatch(/exactly one/i);
  });

  it('shows View generation progress while a job is active', () => {
    const a = resolveWizardPrimaryAction({ ...base, jobStatus: 'processing' });
    expect(a.kind).toBe('view-progress');
    expect(a.label).toBe('View generation progress');
    expect(a.to).toContain('/generate');
  });

  it('shows Open GLB Studio when generation completed', () => {
    const a = resolveWizardPrimaryAction({
      ...base,
      jobStatus: 'completed',
      hasGeneratedModel: true,
      projectStatus: 'generated',
    });
    expect(a.kind).toBe('open-studio');
    expect(a.label).toBe('Open GLB Studio');
    expect(a.to).toContain('/studio');
    expect(a.supportingCopy).toMatch(/model is ready/i);
  });

  it('shows Retry generation after failure', () => {
    const a = resolveWizardPrimaryAction({ ...base, jobStatus: 'failed' });
    expect(a.kind).toBe('retry');
    expect(a.label).toBe('Retry generation');
    expect(a.to).toContain('/generate');
  });
});
