/**
 * Service-layer tests. The mock lives at the one true API boundary —
 * src/lib/supabaseClient — everything above it (service logic: slug retry,
 * error mapping, cleanup-on-failure ordering) runs for real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A minimal chainable PostgREST-style stub whose terminal results the tests
// script per call.
interface ScriptedResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

const scripted: ScriptedResult[] = [];
const calls: { table?: string; op: string; args?: unknown }[] = [];

function chain(table?: string) {
  const self: Record<string, unknown> = {};
  const record = (op: string) => (...args: unknown[]) => {
    calls.push({ table, op, args });
    return self;
  };
  for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order']) {
    self[op] = record(op);
  }
  const terminal = () => Promise.resolve(scripted.shift() ?? { data: null, error: null });
  self.single = () => {
    calls.push({ table, op: 'single' });
    return terminal();
  };
  self.maybeSingle = () => {
    calls.push({ table, op: 'maybeSingle' });
    return terminal();
  };
  // Awaiting the chain itself (list queries) resolves the next scripted result.
  self.then = (resolve: (v: ScriptedResult) => void, reject: (e: unknown) => void) =>
    terminal().then(resolve, reject);
  return self;
}

const storageRemove = vi.fn(async (..._args: unknown[]) => ({ data: null, error: null }));
const storageUpload = vi.fn(async (..._args: unknown[]) => ({ data: { path: 'x' }, error: null }));
const storageCreateSignedUrl = vi.fn(async () => ({
  data: { signedUrl: 'https://signed.example/url' },
  error: null,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-123' } }, error: null })),
    },
    from: (table: string) => chain(table),
    storage: {
      from: () => ({
        upload: storageUpload,
        remove: storageRemove,
        createSignedUrl: storageCreateSignedUrl,
      }),
    },
  },
}));

import { uploadSourceImage } from '../../uploads/sourceImageService';
import { createProject, getProject, ProjectServiceError } from './projectService';

beforeEach(() => {
  scripted.length = 0;
  calls.length = 0;
  storageRemove.mockClear();
  storageUpload.mockClear();
});

describe('createProject', () => {
  it('sets ownership from the authenticated session, never from input', async () => {
    scripted.push({ data: { id: 'p1', owner_id: 'user-123' }, error: null });
    await createProject({ name: 'My Cake', mode: 'markerless_surface' });
    const insert = calls.find((c) => c.op === 'insert');
    expect(insert).toBeDefined();
    const row = (insert!.args as [Record<string, unknown>])[0];
    expect(row.owner_id).toBe('user-123');
    expect(row.status).toBe('draft');
    expect(row.wizard_stage).toBe('details');
    expect(String(row.slug)).toMatch(/^my-cake-[a-z0-9]{8}$/);
  });

  it('retries once with a fresh slug on a unique violation, then succeeds', async () => {
    scripted.push({ data: null, error: { message: 'duplicate key', code: '23505' } });
    scripted.push({ data: { id: 'p2' }, error: null });
    const project = await createProject({ name: 'My Cake', mode: 'markerless_surface' });
    expect(project).toEqual({ id: 'p2' });
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(2);
  });

  it('maps other failures to a safe, generic error', async () => {
    scripted.push({ data: null, error: { message: 'connection reset', code: '08006' } });
    await expect(
      createProject({ name: 'My Cake', mode: 'markerless_surface' }),
    ).rejects.toMatchObject({ code: 'request-failed' });
  });
});

describe('getProject', () => {
  it('treats an RLS-empty result as not-found (indistinguishable from another user\u2019s project)', async () => {
    scripted.push({ data: null, error: null });
    await expect(getProject('someone-elses-id')).rejects.toMatchObject({
      code: 'not-found',
    });
  });
});

describe('uploadSourceImage', () => {
  const input = {
    projectId: 'p1',
    file: new File(['x'], 'front.jpg', { type: 'image/jpeg' }),
    width: 800,
    height: 600,
    angleLabel: null,
    sortOrder: 0,
  };

  it('removes the uploaded object when the metadata insert fails (no orphans)', async () => {
    scripted.push({ data: null, error: { message: 'row violates policy' } });
    await expect(uploadSourceImage(input)).rejects.toBeInstanceOf(ProjectServiceError);
    expect(storageUpload).toHaveBeenCalledTimes(1);
    expect(storageRemove).toHaveBeenCalledTimes(1);
    // The removed path is the same one that was uploaded.
    const uploadedPath = storageUpload.mock.calls[0]?.[0];
    expect(storageRemove.mock.calls[0]?.[0]).toEqual([uploadedPath]);
  });

  it('creates no record when the storage upload itself fails', async () => {
    storageUpload.mockResolvedValueOnce({
      data: null,
      error: { message: 'quota exceeded' },
    } as never);
    await expect(uploadSourceImage(input)).rejects.toBeInstanceOf(ProjectServiceError);
    expect(calls.find((c) => c.op === 'insert')).toBeUndefined();
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('uploads under the {userId}/{projectId}/{imageId}-{filename} convention', async () => {
    scripted.push({ data: { id: 'img-1' }, error: null });
    await uploadSourceImage(input);
    const path = String(storageUpload.mock.calls[0]?.[0]);
    expect(path).toMatch(/^user-123\/p1\/[0-9a-f-]{36}-front\.jpg$/);
  });
});
