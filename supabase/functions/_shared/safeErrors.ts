/** Safe user-facing error codes for generation jobs. Never echo raw provider text. */

const SAFE: Record<string, string> = {
  'provider-not-configured':
    'Image-to-3D is not configured yet. Ask an admin to set the provider secrets.',
  'mock-disabled': 'The development mock provider is disabled on this server.',
  'invalid-provider-key': 'The image-to-3D provider rejected the API key.',
  'provider-rate-limit': 'The provider is rate-limiting requests. Try again later.',
  'provider-quota-exceeded': 'Provider credits or quota are exhausted.',
  'provider-submit-failed': 'Could not start generation with the provider. Try again.',
  'provider-status-failed': 'Could not refresh generation status. Try again.',
  'provider-timeout': 'The provider timed out. You can retry generation.',
  'provider-generation-failed': 'The provider could not build a 3D model from these photos.',
  'invalid-images': 'Source images are missing or invalid for this project.',
  'missing-images': 'Upload the required photos before generating.',
  'duplicate-active-job': 'A generation job is already running for this project.',
  'entitlement-exhausted': 'You have used the development generation limit.',
  'unauthorized': 'Sign in again to continue.',
  'forbidden': 'You do not own this project.',
  'bad-source-method': 'Generation only works for single-image or multi-view projects.',
  'download-failed': 'Could not download the generated model securely.',
  'invalid-glb': 'The provider returned a file that is not a valid GLB.',
  'upload-failed': 'Could not store the generated model.',
  'database-failed': 'Could not save generation state. Try again.',
  'cancelled': 'Generation was cancelled.',
  'offline': 'You appear to be offline. Check your connection and try again.',
  'unknown': 'Something went wrong. Please try again.',
};

export function mapSafeError(code: string | undefined): {
  safe_error_code: string;
  safe_error_message: string;
} {
  const key = code && SAFE[code] ? code : 'unknown';
  return { safe_error_code: key, safe_error_message: SAFE[key]! };
}
