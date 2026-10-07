import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

/**
 * Resolves a library-relative path to an absolute path and guarantees the
 * result stays inside the configured music library root (PRD §25/§63).
 *
 * DB paths are always stored relative to the library root, so an absolute or
 * `..`-laden value is rejected outright.
 */
export function resolveLibraryPath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) {
    throw Object.assign(new Error('Invalid file path'), { code: 'INVALID_PATH' });
  }
  if (relativePath.includes('\0')) {
    throw Object.assign(new Error('Invalid file path'), { code: 'INVALID_PATH' });
  }

  const root = path.resolve(config.libraryPath);
  const cleaned = relativePath.replace(/^[/\\]+/, '');
  const absolute = path.resolve(root, cleaned);

  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw Object.assign(new Error('Path escapes the music library'), { code: 'PATH_TRAVERSAL' });
  }
  return absolute;
}

/**
 * Same guard, but also follows symlinks so a link pointing outside the library
 * is rejected. Use this before actually reading/serving a file.
 */
export function resolveLibraryPathStrict(relativePath) {
  const absolute = resolveLibraryPath(relativePath);
  const root = fs.realpathSync(path.resolve(config.libraryPath));

  let real;
  try {
    real = fs.realpathSync(absolute);
  } catch {
    throw Object.assign(new Error('File not found'), { code: 'ENOENT' });
  }

  if (real !== root && !real.startsWith(root + path.sep)) {
    throw Object.assign(new Error('Path escapes the music library'), { code: 'PATH_TRAVERSAL' });
  }
  return real;
}

/** Converts an absolute path inside the library into the stored relative form. */
export function toLibraryRelative(absolutePath) {
  const root = path.resolve(config.libraryPath);
  const relative = path.relative(root, path.resolve(absolutePath));
  if (relative.startsWith('..')) {
    throw Object.assign(new Error('Path escapes the music library'), { code: 'PATH_TRAVERSAL' });
  }
  return relative.split(path.sep).join('/');
}
