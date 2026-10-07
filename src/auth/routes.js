import { config } from '../config.js';
import { get, run } from '../database/index.js';
import { hashPassword, verifyPassword, validatePassword, validateUsername } from './password.js';
import { createSession, deleteSession, cookieOptionsFor } from './sessions.js';
import { serializeUser } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { ok, badRequest, unauthorized, tooMany } from '../utils/http.js';
import { logger } from '../logger.js';

const limiter = createRateLimiter(config.loginRateLimit);

function userCount() {
  return get('SELECT COUNT(*) AS n FROM users').n;
}

function setSessionCookie(request, reply, sessionId) {
  reply.setCookie(config.cookieName, sessionId, {
    ...cookieOptionsFor(request),
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  });
}

export async function authRoutes(app) {
  /** Used by the login screen to decide between "sign in" and "create admin". */
  app.get('/api/auth/status', async (request, reply) =>
    ok(reply, { setupRequired: userCount() === 0, privateMode: config.privateMode }),
  );

  /** First-run setup (PRD §75/§126) — only possible while no users exist. */
  app.post('/api/auth/setup', async (request, reply) => {
    if (userCount() > 0) throw badRequest('Setup has already been completed.', 'ALREADY_SETUP');

    const username = String(request.body?.username || '').trim();
    const password = String(request.body?.password || '');
    const usernameError = validateUsername(username);
    if (usernameError) throw badRequest(usernameError, 'INVALID_USERNAME');
    const passwordError = validatePassword(password);
    if (passwordError) throw badRequest(passwordError, 'WEAK_PASSWORD');

    const hash = await hashPassword(password);
    const result = run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, 'admin']);
    const userId = Number(result.lastInsertRowid);
    run("UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", [userId]);

    const session = createSession(userId, request.headers['user-agent']);
    setSessionCookie(request, reply, session.id);
    logger.info('admin created via setup', { username });
    return ok(reply, serializeUser(get('SELECT * FROM users WHERE id = ?', [userId])), 201);
  });

  app.post('/api/auth/login', async (request, reply) => {
    const ip = request.ip;
    if (limiter.isBlocked(ip)) {
      const seconds = Math.ceil(limiter.retryAfterMs(ip) / 1000);
      reply.header('Retry-After', seconds);
      throw tooMany(`Too many failed attempts. Try again in ${seconds}s.`);
    }

    const username = String(request.body?.username || '').trim();
    const password = String(request.body?.password || '');
    const row = username ? get('SELECT * FROM users WHERE username = ?', [username]) : null;

    // Always run a verification to keep the response time uniform.
    const valid = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');

    if (!row || !valid) {
      limiter.recordFailure(ip);
      logger.warn('failed login', { username, ip, remaining: limiter.remaining(ip) });
      throw unauthorized('Invalid username or password.', 'INVALID_CREDENTIALS');
    }

    limiter.reset(ip);
    run("UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", [row.id]);
    const session = createSession(row.id, request.headers['user-agent']);
    setSessionCookie(request, reply, session.id);
    logger.info('login', { username: row.username, ip });
    return ok(reply, serializeUser(get('SELECT * FROM users WHERE id = ?', [row.id])));
  });

  app.post('/api/auth/logout', async (request, reply) => {
    if (request.sessionId) deleteSession(request.sessionId);
    reply.clearCookie(config.cookieName, { ...cookieOptionsFor(request), maxAge: 0 });
    return ok(reply, { loggedOut: true });
  });

  app.get('/api/auth/me', async (request, reply) => {
    if (!request.user) throw unauthorized();
    return ok(reply, request.user);
  });
}
