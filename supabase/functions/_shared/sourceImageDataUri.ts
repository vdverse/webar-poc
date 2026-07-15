/** Build a Meshy-compatible data URI from bytes already downloaded. */

const MESHY_MIME = new Set(['image/jpeg', 'image/png']);

export function bytesToDataUri(mimeType: string, buf: Uint8Array): string {
  const mime = mimeType.toLowerCase();
  if (!MESHY_MIME.has(mime)) {
    throw Object.assign(new Error('unsupported mime'), { code: 'invalid-images' });
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export async function sourceImageToDataUri(input: {
  service: {
    storage: {
      from: (bucket: string) => {
        download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>;
      };
    };
  };
  bucket: string;
  storagePath: string;
  mimeType: string | null;
}): Promise<string> {
  const mime = (input.mimeType ?? '').toLowerCase();
  if (!MESHY_MIME.has(mime)) {
    throw Object.assign(new Error('unsupported mime'), { code: 'invalid-images' });
  }

  const { data, error } = await input.service.storage.from(input.bucket).download(input.storagePath);
  if (error || !data) {
    throw Object.assign(new Error(error?.message ?? 'download failed'), { code: 'invalid-images' });
  }

  const buf = new Uint8Array(await data.arrayBuffer());
  return bytesToDataUri(mime, buf);
}
