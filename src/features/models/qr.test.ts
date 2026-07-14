import { describe, expect, it } from 'vitest';

import { generateQrPngDataUrl, generateQrSvg } from './qr';

describe('QR generation', () => {
  it('encodes the viewer URL into a PNG data URL', async () => {
    const url = 'https://example.com/webar-poc/view/demo-slug';
    const png = await generateQrPngDataUrl(url);
    expect(png.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('encodes the viewer URL into SVG markup', async () => {
    const url = 'https://example.com/webar-poc/view/demo-slug';
    const svg = await generateQrSvg(url);
    expect(svg).toMatch(/<svg[\s\S]*<\/svg>/i);
  });
});
