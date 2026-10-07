import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveLibraryPath, toLibraryRelative } from '../src/utils/paths.js';
import { config } from '../src/config.js';

const root = path.resolve(config.libraryPath);

test('resolves normal paths inside the library root', () => {
  const resolved = resolveLibraryPath('Artist/Album/01 - Song.mp3');
  assert.equal(resolved, path.join(root, 'Artist', 'Album', '01 - Song.mp3'));
});

test('tolerates a leading separator', () => {
  assert.equal(resolveLibraryPath('/Artist/song.mp3'), path.join(root, 'Artist', 'song.mp3'));
});

test('blocks directory traversal (PRD §25)', () => {
  for (const attempt of [
    '../../etc/passwd',
    'Artist/../../../etc/passwd',
    '..\\..\\windows\\system32\\config\\sam',
    './../../secret.mp3',
  ]) {
    assert.throws(() => resolveLibraryPath(attempt), /escapes the music library|Invalid file path/, attempt);
  }
});

test('blocks absolute paths that escape the root', () => {
  const outside = process.platform === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/passwd';
  assert.throws(() => resolveLibraryPath(outside), /escapes the music library|Invalid file path/);
});

test('blocks null bytes and empty input', () => {
  assert.throws(() => resolveLibraryPath('Artist/song\0.mp3'), /Invalid file path/);
  assert.throws(() => resolveLibraryPath(''), /Invalid file path/);
  assert.throws(() => resolveLibraryPath(null), /Invalid file path/);
});

test('toLibraryRelative round-trips inside the root', () => {
  const absolute = path.join(root, 'A', 'B', 'c.mp3');
  assert.equal(toLibraryRelative(absolute), 'A/B/c.mp3');
});
