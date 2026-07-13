import { useSignedPreviewQuery } from '../sourceImageHooks';

/**
 * Renders a private source image via a short-lived signed URL minted on
 * demand (never persisted). Shows a neutral block while the URL loads and
 * an explicit failure state if signing fails.
 */
export function SignedThumb({ path, alt }: { path: string; alt: string }) {
  const preview = useSignedPreviewQuery(path);
  if (preview.isPending) {
    return <div className="upload-thumb" aria-hidden="true" />;
  }
  if (preview.isError) {
    return (
      <div className="upload-thumb" role="img" aria-label={`${alt} (preview unavailable)`} />
    );
  }
  return <img className="upload-thumb" src={preview.data} alt={alt} />;
}
