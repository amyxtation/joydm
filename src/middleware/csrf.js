import { forbidden } from '../utils/http.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for cookie-authenticated state-changing requests (PRD §123).
 *
 * Combined with the `SameSite=Lax` session cookie, validating that the
 * `Origin` (when the browser sends one) matches the request host blocks
 * cross-site form/fetch submissions. Non-browser clients (curl, healthchecks)
 * send no Origin and are not subject to CSRF.
 */
export function verifyOrigin(request) {
  if (SAFE_METHODS.has(request.method)) return;

  const origin = request.headers.origin;
  if (!origin) return;

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden('Invalid Origin header');
  }

  const host = request.headers['x-forwarded-host'] || request.headers.host;
  if (!host || originHost !== host) {
    throw forbidden('Cross-site request blocked');
  }
}
