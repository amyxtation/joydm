import { config } from '../config.js';
import { get } from '../database/index.js';
import { getSession } from '../auth/sessions.js';
import { unauthorized, forbidden } from '../utils/http.js';

export function serializeUser(row) {
  return {
    id: String(row.id),
    username: row.username,
    role: row.role,
    lastLoginAt: row.last_login_at || null,
  };
}

/** preHandler hook: resolves the session cookie into `request.user`. */
export async function attachUser(request) {
  const sessionId = request.cookies?.[config.cookieName];
  if (!sessionId) return;
  const session = getSession(sessionId);
  if (!session) return;
  const user = get('SELECT * FROM users WHERE id = ?', [session.user_id]);
  if (!user) return;
  request.user = serializeUser(user);
  request.sessionId = sessionId;
}

/** Throws 401 unless the request is authenticated (no-op in public mode). */
export function requireAuth(request) {
  if (!config.privateMode) return;
  if (!request.user) throw unauthorized();
}

/** Throws 403 unless the authenticated user is an admin. */
export function requireAdmin(request) {
  requireAuth(request);
  if (request.user?.role !== 'admin') throw forbidden('Administrator access required');
}
