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

export const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
};
