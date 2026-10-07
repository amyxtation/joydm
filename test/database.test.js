import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Must be set before config.js is loaded (dynamic import below).
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'joydm-db-'));
process.env.DATABASE_PATH = path.join(tempDir, 'test.db');

const { initDatabase, closeDatabase, run, get } = await import('../src/database/index.js');
const repo = await import('../src/library/repository.js');
const userRepo = await import('../src/user/repository.js');

initDatabase();

run("INSERT INTO users (username, password_hash, role) VALUES ('tester', 'x', 'admin')");
const userId = get("SELECT id FROM users WHERE username = 'tester'").id;

function seedTrack(title, { artist = 'A', album = 'Al', genre = 'G', year = 2020, duration = 200, trackNumber = 1, path: filePath } = {}) {
  const artistId = repo.upsertArtist(artist);
  const albumId = repo.upsertAlbum(album, artistId, year);
  const genreId = genre ? repo.upsertGenre(genre) : null;
  return repo.insertTrack({
    title,
    artistId,
    albumId,
    genreId,
    trackNumber,
    year,
    duration,
    filePath: filePath || `/${artist}/${album}/${title}.mp3`,
    fileSize: 1234,
    mimeType: 'audio/mpeg',
    fileModifiedAt: new Date().toISOString(),
  });
}

test('migrations create the expected tables', () => {
  for (const table of ['users', 'tracks', 'artists', 'albums', 'genres', 'playlists', 'playlist_tracks', 'favorites', 'playback_history', 'user_settings', 'sessions']) {
    assert.ok(
      get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [table]),
      `missing table ${table}`,
    );
  }
  const applied = get('SELECT COUNT(*) AS n FROM schema_migrations').n;
  assert.ok(applied >= 1, 'migrations recorded');
});

test('entity upserts are idempotent', () => {
  const first = repo.upsertArtist('Repeat Artist');
  const second = repo.upsertArtist('Repeat Artist');
  assert.equal(first, second);
  assert.equal(repo.upsertArtist('repeat artist'), first, 'normalised name matches');
  assert.equal(repo.upsertGenre('Jazz'), repo.upsertGenre('jazz'));
});

test('tracks round-trip with string ids and camelCase fields', () => {
  const id = seedTrack('Round Trip', { artist: 'RT Artist', album: 'RT Album', genre: 'Rock', duration: 245 });
  const track = repo.getTrackById(id);
  assert.equal(typeof track.id, 'string');
  assert.equal(track.title, 'Round Trip');
  assert.equal(track.artist, 'RT Artist');
  assert.equal(track.album, 'RT Album');
  assert.equal(track.genre, 'Rock');
  assert.equal(track.duration, 245);
  assert.equal(track.format, 'MP3');
  assert.equal(track.mimeType, 'audio/mpeg');
  assert.equal(track.available, true);
  assert.equal(track.artworkSeed, `al-${track.albumId}`);
});

test('missing tracks are excluded by default', () => {
  const id = seedTrack('Gone', { artist: 'Ghost', album: 'Ghost Album', path: '/Ghost/Ghost Album/gone.mp3' });
  repo.setTrackMissing(id, true);
  const listed = repo.listTracks({ q: 'Gone' }).items;
  assert.equal(listed.length, 0);
});

test('pagination and sorting', () => {
  for (let i = 1; i <= 5; i += 1) {
    seedTrack(`Page Track ${i}`, { artist: 'Pager', album: 'Pages', duration: 100 + i, path: `/Pager/Pages/${i}.mp3` });
  }
  const page1 = repo.listTracks({ q: 'Page Track', limit: 2, page: 1, sort: 'duration', order: 'desc' });
  assert.equal(page1.items.length, 2);
  assert.equal(page1.pagination.total, 5);
  assert.equal(page1.pagination.total_pages, 3);
  assert.equal(page1.items[0].duration, 105);

  const page3 = repo.listTracks({ q: 'Page Track', limit: 2, page: 3, sort: 'duration', order: 'desc' });
  assert.equal(page3.items.length, 1);
});

test('filters by artist, album and genre', () => {
  const artist = repo.listArtists().find((a) => a.name === 'Pager');
  assert.equal(artist.trackCount, 5);
  assert.equal(repo.listTracks({ artistId: artist.id }).pagination.total, 5);
  const album = repo.listAlbums().find((a) => a.title === 'Pages');
  assert.equal(album.trackCount, 5);
  assert.equal(repo.listTracks({ albumId: album.id }).pagination.total, 5);
});

test('search matches title, artist and album', () => {
  assert.ok(repo.search('Round Trip').tracks.length >= 1);
  assert.ok(repo.search('Pager').artists.length >= 1);
  assert.ok(repo.search('Pages').albums.length >= 1);
});

test('library stats aggregate correctly', () => {
  const stats = repo.libraryStats();
  assert.ok(stats.tracks >= 6);
  assert.ok(stats.artists >= 2);
  assert.ok(stats.duration > 0);
  assert.ok(stats.storageUsedBytes > 0);
});

test('playlists support create, add, reorder and remove', () => {
  const a = seedTrack('PL A', { artist: 'PL', album: 'PL', path: '/PL/a.mp3' });
  const b = seedTrack('PL B', { artist: 'PL', album: 'PL', path: '/PL/b.mp3' });

  const playlist = userRepo.createPlaylist(userId, { name: 'Mix', trackIds: [String(a), String(b)] });
  assert.equal(playlist.trackCount, 2);
  assert.deepEqual(playlist.tracks.map((t) => t.title), ['PL A', 'PL B']);

  const reordered = userRepo.reorderPlaylist(userId, Number(playlist.id), [String(b), String(a)]);
  assert.deepEqual(reordered.tracks.map((t) => t.title), ['PL B', 'PL A']);

  const afterRemove = userRepo.removePlaylistTrack(userId, Number(playlist.id), String(b));
  assert.equal(afterRemove.trackCount, 1);

  assert.equal(userRepo.deletePlaylist(userId, Number(playlist.id)), true);
  assert.equal(userRepo.getPlaylist(userId, Number(playlist.id)), null);
});

test('favourites are unique per user and track', () => {
  const track = seedTrack('Fav', { artist: 'Fav', album: 'Fav', path: '/Fav/fav.mp3' });
  userRepo.addFavorite(userId, track);
  userRepo.addFavorite(userId, track);
  assert.equal(userRepo.listFavorites(userId).filter((t) => t.title === 'Fav').length, 1);
  userRepo.removeFavorite(userId, track);
  assert.equal(userRepo.listFavorites(userId).filter((t) => t.title === 'Fav').length, 0);
});

test('history upserts one row per track and returns camelCase', () => {
  const track = seedTrack('Hist', { artist: 'Hist', album: 'Hist', path: '/Hist/h.mp3' });
  userRepo.recordHistory(userId, track, 10);
  userRepo.recordHistory(userId, track, 42);
  const rows = userRepo.listHistory(userId).filter((row) => row.track.title === 'Hist');
  assert.equal(rows.length, 1, 'one row per track');
  assert.equal(rows[0].position, 42, 'position updated');
  assert.equal(typeof rows[0].trackId, 'string');
  assert.equal(rows[0].track.title, 'Hist');
});

test('settings fall back to defaults and persist changes', () => {
  assert.deepEqual(userRepo.getSettings(userId), {
    theme: 'dark',
    volume: 0.8,
    shuffle: false,
    repeatMode: 'off',
    autoplay: true,
  });
  const saved = userRepo.saveSettings(userId, { theme: 'light', volume: 0.4, repeatMode: 'all' });
  assert.equal(saved.theme, 'light');
  assert.equal(saved.volume, 0.4);
  assert.equal(saved.repeatMode, 'all');
  assert.equal(userRepo.getSettings(userId).theme, 'light');
});

after(() => {
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
