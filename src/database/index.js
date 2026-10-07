import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { logger } from '../logger.js';

let db;

export function getDb() {
  if (!db) throw new Error('Database not initialised — call initDatabase() first.');
  return db;
}

/** Applies any migration files that have not been recorded yet (PRD §114). */
function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );`);

  const dir = path.join(config.root, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied = new Set(database.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    database.exec('BEGIN');
    try {
      database.exec(sql);
      database.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      database.exec('COMMIT');
      logger.info('migration applied', { file });
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}

export function initDatabase() {
  if (db) return db;
  db = new DatabaseSync(config.databasePath);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA busy_timeout = 5000');

  runMigrations(db);
  logger.info('database ready', { path: config.databasePath });
  return db;
}

export function closeDatabase() {
  if (!db) return;
  db.close();
  db = undefined;
}

/** Runs `fn` inside a transaction, rolling back on error. */
export function transaction(fn) {
  const database = getDb();
  database.exec('BEGIN');
  try {
    const result = fn(database);
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function all(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}
