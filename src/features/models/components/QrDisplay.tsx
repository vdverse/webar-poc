import { useEffect, useState } from 'react';

import {
  downloadDataUrl,
  downloadTextFile,
  generateQrPngDataUrl,
  generateQrSvg,
} from '../qr';

export function QrDisplay({
  viewerUrl,
  title,
}: {
  viewerUrl: string;
  title: string;
}) {
  const [png, setPng] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [p, s] = await Promise.all([generateQrPngDataUrl(viewerUrl), generateQrSvg(viewerUrl)]);
      if (!cancelled) {
        setPng(p);
        setSvg(s);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerUrl]);

  const copy = async () => {
    await navigator.clipboard.writeText(viewerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title, url: viewerUrl, text: `View “${title}” in AR` });
    } else {
      await copy();
    }
  };

  return (
    <div className="qr-panel">
      <h3>QR code</h3>
      <p className="dash-field-hint">Encodes the public viewer URL only — not a private storage link.</p>
      {png ? (
        <img src={png} alt={`QR code for ${title}`} width={220} height={220} className="qr-image" />
      ) : (
        <p>Generating QR…</p>
      )}
      <p className="qr-url">
        <code>{viewerUrl}</code>
      </p>
      <div className="wizard-actions">
        <button type="button" className="dash-button-secondary" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" className="dash-button-secondary" onClick={() => void share()}>
          Share
        </button>
        {png && (
          <button
            type="button"
            className="dash-button-secondary"
            onClick={() => downloadDataUrl(`${title}-qr.png`, png)}
          >
            Download PNG
          </button>
        )}
        {svg && (
          <button
            type="button"
            className="dash-button-secondary"
            onClick={() => downloadTextFile(`${title}-qr.svg`, svg, 'image/svg+xml')}
          >
            Download SVG
          </button>
        )}
      </div>
    </div>
  );
}
