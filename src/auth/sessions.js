import crypto from 'node:crypto';
import { config } from '../config.js';
import { all, get, run } from '../database/index.js';

export function createSession(userId, userAgent = '') {
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();
  run('INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)', [
    id,
    userId,
    expiresAt,
    String(userAgent).slice(0, 255),
  ]);
  return { id, expiresAt };
}

export function getSession(sessionId) {
  if (!sessionId) return null;
  const row = get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    deleteSession(sessionId);
    return null;
  }
  return row;
}

export function deleteSession(sessionId) {
  if (sessionId) run('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

export function deleteUserSessions(userId) {
  run('DELETE FROM sessions WHERE user_id = ?', [userId]);
}

/** Housekeeping — called on boot and after logins. */
export function purgeExpiredSessions() {
  const result = run('DELETE FROM sessions WHERE expires_at <= ?', [new Date().toISOString()]);
  return result.changes || 0;
}

export function sessionCountFor(userId) {
  return all('SELECT id FROM sessions WHERE user_id = ?', [userId]).length;
}

/**
 * Cookie attributes for the session.
 *
 * `Secure` is derived from the actual request scheme rather than from
 * APP_ENV: a browser silently discards a `Secure` cookie sent over plain HTTP,
 * so a LAN deployment at http://host:8080 would look like a failed login.
 * Set COOKIE_SECURE to override.
 */
export function cookieOptionsFor(request) {
  const secure = config.cookieSecure ?? request?.protocol === 'https';
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
  };
}
