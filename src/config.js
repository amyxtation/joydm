import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

// Load .env if present (Node's built-in loader — no dotenv dependency).
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  /* no .env file — rely on the real environment */
}

function str(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function num(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function resolveFromRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

/**
 * APP_ENV is authoritative (PRD §73) — deliberately not inherited from
 * NODE_ENV, which many hosts set to `production` globally and which would
 * otherwise force production requirements onto local development.
 */
const env = str('APP_ENV', 'development');
const isProduction = env === 'production';

let sessionSecret = str('SESSION_SECRET', '');
if (!sessionSecret) {
  if (isProduction) {
    throw new Error('SESSION_SECRET must be set when APP_ENV=production (see .env.example).');
  }
  // Ephemeral dev secret: sessions reset on restart, which is fine locally.
  sessionSecret = crypto.randomBytes(32).toString('hex');
}

export const config = {
  root: ROOT,
  env,
  isProduction,
  host: str('APP_HOST', '0.0.0.0'),
  port: num('APP_PORT', 8080),

  databasePath: resolveFromRoot(str('DATABASE_PATH', './data/music.db')),
  libraryPath: resolveFromRoot(str('MUSIC_LIBRARY_PATH', './music-library')),
  logPath: resolveFromRoot(str('LOG_PATH', './logs')),

  sessionSecret,
  sessionTtlMs: num('SESSION_TTL_HOURS', 24 * 30) * 60 * 60 * 1000,
  cookieName: 'joydm_session',

  /**
   * Session cookie `Secure` flag.
   * `undefined` (the default) means "match the request scheme", which is what
   * you want: HTTPS deployments get Secure cookies, while a plain-HTTP LAN
   * deployment still works instead of silently dropping the cookie.
   * Set COOKIE_SECURE=true/false to force it.
   */
  cookieSecure: process.env.COOKIE_SECURE === undefined ? undefined : bool('COOKIE_SECURE', false),

  logLevel: str('LOG_LEVEL', 'info'),

  /** When true, library + streaming require an authenticated user (PRD §65). */
  privateMode: bool('PRIVATE_MODE', true),
  allowDownload: bool('ALLOW_DOWNLOAD', false),

  /** Metadata parsing concurrency — keeps scanning gentle (PRD §116). */
  scanConcurrency: Math.max(1, Math.min(4, num('SCAN_CONCURRENCY', 3))),
  /** Run a scan automatically 2s after boot (PRD §29 startup scan, non-blocking). */
  scanOnStartup: bool('SCAN_ON_STARTUP', false),

  /** Per-IP login attempts allowed per minute (PRD §64). */
  loginRateLimit: { attempts: num('LOGIN_ATTEMPTS_PER_MINUTE', 5), windowMs: 60_000 },
};

for (const dir of [path.dirname(config.databasePath), config.logPath, config.libraryPath]) {
  fs.mkdirSync(dir, { recursive: true });
}

export const paths = {
  artworkCache: path.join(path.dirname(config.databasePath), 'cache', 'artwork'),
};
fs.mkdirSync(paths.artworkCache, { recursive: true });
