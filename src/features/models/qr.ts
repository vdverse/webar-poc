import QRCode from 'qrcode';

/** Encode only the public viewer URL — never private/signed storage URLs. */
export async function generateQrPngDataUrl(viewerUrl: string): Promise<string> {
  return QRCode.toDataURL(viewerUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#111111', light: '#ffffff' },
  });
}

export async function generateQrSvg(viewerUrl: string): Promise<string> {
  return QRCode.toString(viewerUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#111111', light: '#ffffff' },
  });
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function downloadTextFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
