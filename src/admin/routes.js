import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config, paths } from '../config.js';
import { logger } from '../logger.js';
import { all, get, run } from '../database/index.js';
import { runScan, getScanStatus, isScanning } from '../indexer/scanner.js';
import { hashPassword, validatePassword, validateUsername } from '../auth/password.js';
import { deleteUserSessions } from '../auth/sessions.js';
import { serializeUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';
import { ok, notFound, badRequest, forbidden, tooMany } from '../utils/http.js';

let lastCpuSample = null;

/** CPU usage since the previous call (PRD §28). */
function cpuPercent() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) total += cpu.times[type];
    idle += cpu.times.idle;
  }
  const sample = { idle, total, at: Date.now() };
  if (!lastCpuSample) {
    lastCpuSample = sample;
    return 0;
  }
  const idleDelta = sample.idle - lastCpuSample.idle;
  const totalDelta = sample.total - lastCpuSample.total;
  lastCpuSample = sample;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100));
}

async function diskUsage() {
  try {
    const stats = await fs.statfs(config.libraryPath);
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    return { usedBytes: total - free, totalBytes: total };
  } catch {
    return { usedBytes: 0, totalBytes: 0 };
  }
}

function numericId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${label}`, 'INVALID_ID');
  return id;
}

export async function adminRoutes(app) {
  app.addHook('preHandler', async (request) => requireAdmin(request));

  /* --------------------------------- scanner ------------------------------- */

  app.post('/api/admin/library/scan', async (request, reply) => {
    if (isScanning()) throw tooMany('A scan is already running.', 'SCAN_IN_PROGRESS');
    const force = request.query?.force === '1' || request.body?.force === true;
    // Fire and forget — the request returns immediately (PRD §30).
    runScan({ reason: force ? 'reindex' : 'manual', force }).catch((error) =>
      logger.error('background scan crashed', { error: error.message }),
    );
    return ok(reply, getScanStatus(), 202);
  });

  app.get('/api/admin/library/scan/status', async (request, reply) => ok(reply, getScanStatus()));

  app.post('/api/admin/library/cleanup-missing', async (request, reply) => {
    const result = run('DELETE FROM tracks WHERE missing = 1');
    return ok(reply, { removed: result.changes || 0 });
  });

  app.post('/api/admin/cache/clear', async (request, reply) => {
    let removed = 0;
    try {
      const entries = await fs.readdir(paths.artworkCache);
      for (const entry of entries) {
        await fs.rm(path.join(paths.artworkCache, entry), { force: true });
        removed += 1;
      }
    } catch {
      /* cache dir may be empty or missing */
    }
    run('UPDATE albums SET artwork_path = NULL, artwork_hash = NULL');
    return ok(reply, { removed });
  });

  /* --------------------------------- system -------------------------------- */

  app.get('/api/admin/system/status', async (request, reply) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const pkg = await fs.readFile(path.join(config.root, 'package.json'), 'utf8').catch(() => '{"version":"0.1.0"}');
    return ok(reply, {
      version: JSON.parse(pkg).version || '0.1.0',
      env: config.env,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      cpuPercent: cpuPercent(),
      memory: { usedBytes: totalMem - freeMem, totalBytes: totalMem },
      disk: await diskUsage(),
      libraryPath: config.libraryPath,
      scanning: isScanning(),
    });
  });

  /* ---------------------------------- users -------------------------------- */

  app.get('/api/admin/users', async (request, reply) =>
    ok(
      reply,
      all('SELECT * FROM users ORDER BY role DESC, username COLLATE NOCASE').map((row) => ({
        ...serializeUser(row),
        createdAt: row.created_at,
      })),
    ),
  );

  app.post('/api/admin/users', async (request, reply) => {
    const body = request.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const role = body.role === 'admin' ? 'admin' : 'user';

    const usernameError = validateUsername(username);
    if (usernameError) throw badRequest(usernameError, 'INVALID_USERNAME');
    const passwordError = validatePassword(password);
    if (passwordError) throw badRequest(passwordError, 'WEAK_PASSWORD');
    if (get('SELECT id FROM users WHERE username = ?', [username])) {
      throw badRequest('That username is already taken.', 'USERNAME_TAKEN');
    }

    const hash = await hashPassword(password);
    const result = run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, role]);
    const user = get('SELECT * FROM users WHERE id = ?', [Number(result.lastInsertRowid)]);
    logger.info('user created', { username, role, by: request.user.username });
    return ok(reply, serializeUser(user), 201);
  });

  app.put('/api/admin/users/:id', async (request, reply) => {
    const id = numericId(request.params.id, 'user id');
    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw notFound('User not found', 'USER_NOT_FOUND');

    const role = request.body?.role;
    if (role != null) {
      if (!['admin', 'user'].includes(role)) throw badRequest('Invalid role', 'INVALID_ROLE');
      if (user.role === 'admin' && role === 'user' && adminCount() <= 1) {
        throw badRequest('Cannot demote the last administrator.', 'LAST_ADMIN');
      }
      run('UPDATE users SET role = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') WHERE id = ?', [role, id]);
      if (role !== 'admin') deleteUserSessions(id); // revoke admin sessions on demotion
    }

    if (request.body?.password != null) {
      const passwordError = validatePassword(String(request.body.password));
      if (passwordError) throw badRequest(passwordError, 'WEAK_PASSWORD');
      run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(String(request.body.password)), id]);
      deleteUserSessions(id);
    }

    return ok(reply, serializeUser(get('SELECT * FROM users WHERE id = ?', [id])));
  });

  app.delete('/api/admin/users/:id', async (request, reply) => {
    const id = numericId(request.params.id, 'user id');
    const user = get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw notFound('User not found', 'USER_NOT_FOUND');
    if (Number(request.user.id) === id) throw forbidden('You cannot delete your own account.');
    if (user.role === 'admin' && adminCount() <= 1) throw badRequest('Cannot delete the last administrator.', 'LAST_ADMIN');

    run('DELETE FROM users WHERE id = ?', [id]);
    logger.info('user deleted', { username: user.username, by: request.user.username });
    return ok(reply, { deleted: true });
  });
}

function adminCount() {
  return get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").n;
}
