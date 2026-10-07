/** User-owned data: playlists, favourites, playback history and settings. */

import { all, get, run, transaction } from '../database/index.js';
import { serializeTrack } from '../library/repository.js';

function serializePlaylist(row, tracks = null) {
  const id = String(row.id);
  const list = tracks || [];
  return {
    id,
    name: row.name,
    description: row.description || '',
    trackCount: tracks ? list.length : Number(row.track_count) || 0,
    duration: tracks ? list.reduce((sum, t) => sum + t.duration, 0) : Number(row.duration) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    artworkSeed: list[0]?.artworkSeed || `pl-${id}`,
    ...(tracks ? { tracks: list } : {}),
  };
}

const PLAYLIST_SUMMARY_SQL = `
  SELECT p.*,
    (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count,
    (SELECT COALESCE(SUM(t.duration), 0) FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = p.id) AS duration
  FROM playlists p
`;

const PLAYLIST_TRACKS_SQL = `
  SELECT pt.position AS position, t.*,
    ar.name AS artist_name, al.title AS album_title, al.artwork_path AS artwork_path, g.name AS genre_name
  FROM playlist_tracks pt
  JOIN tracks t       ON t.id = pt.track_id
  LEFT JOIN artists ar ON ar.id = t.artist_id
  LEFT JOIN albums  al ON al.id = t.album_id
  LEFT JOIN genres  g  ON g.id  = t.genre_id
  WHERE pt.playlist_id = ?
  ORDER BY pt.position ASC
`;

export function listPlaylists(userId) {
  return all(`${PLAYLIST_SUMMARY_SQL} WHERE p.user_id = ? ORDER BY p.updated_at DESC`, [userId]).map((row) =>
    serializePlaylist(row),
  );
}

export function getPlaylist(userId, id) {
  const row = get(`${PLAYLIST_SUMMARY_SQL} WHERE p.id = ? AND p.user_id = ?`, [id, userId]);
  if (!row) return null;
  const tracks = all(PLAYLIST_TRACKS_SQL, [id]).map(serializeTrack);
  return serializePlaylist(row, tracks);
}

export function createPlaylist(userId, { name, description = '', trackIds = [] }) {
  return transaction(() => {
    const result = run('INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)', [userId, name, description]);
    const id = Number(result.lastInsertRowid);
    trackIds.forEach((trackId, index) => {
      run('INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [
        id,
        Number(trackId),
        index,
      ]);
    });
    return getPlaylist(userId, id);
  });
}

export function updatePlaylist(userId, id, { name, description }) {
  const row = get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return null;
  run(
    "UPDATE playlists SET name = ?, description = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    [name ?? row.name, description ?? row.description, id],
  );
  return getPlaylist(userId, id);
}

export function deletePlaylist(userId, id) {
  const result = run('DELETE FROM playlists WHERE id = ? AND user_id = ?', [id, userId]);
  return (result.changes || 0) > 0;
}

export function addPlaylistTrack(userId, id, trackId) {
  const row = get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return null;
  transaction(() => {
    const next = get('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM playlist_tracks WHERE playlist_id = ?', [id]).pos;
    run('INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)', [id, trackId, next]);
    run("UPDATE playlists SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", [id]);
  });
  return getPlaylist(userId, id);
}

export function removePlaylistTrack(userId, id, trackId) {
  const row = get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return null;
  transaction(() => {
    run('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [id, trackId]);
    run("UPDATE playlists SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", [id]);
  });
  return getPlaylist(userId, id);
}

export function reorderPlaylist(userId, id, trackIds) {
  const row = get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return null;
  transaction(() => {
    trackIds.forEach((trackId, index) => {
      run('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?', [index, id, Number(trackId)]);
    });
    run("UPDATE playlists SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", [id]);
  });
  return getPlaylist(userId, id);
}

/* -------------------------------- favourites ------------------------------- */

export function listFavorites(userId) {
  return all(
    `SELECT t.*, ar.name AS artist_name, al.title AS album_title, al.artwork_path AS artwork_path, g.name AS genre_name
     FROM favorites f
     JOIN tracks t        ON t.id = f.track_id
     LEFT JOIN artists ar ON ar.id = t.artist_id
     LEFT JOIN albums  al ON al.id = t.album_id
     LEFT JOIN genres  g  ON g.id  = t.genre_id
     WHERE f.user_id = ? AND t.missing = 0
     ORDER BY f.created_at DESC`,
    [userId],
  ).map(serializeTrack);
}

export function addFavorite(userId, trackId) {
  run('INSERT OR IGNORE INTO favorites (user_id, track_id) VALUES (?, ?)', [userId, trackId]);
  return listFavorites(userId).map((t) => t.id);
}

export function removeFavorite(userId, trackId) {
  run('DELETE FROM favorites WHERE user_id = ? AND track_id = ?', [userId, trackId]);
  return listFavorites(userId).map((t) => t.id);
}

/* --------------------------------- history --------------------------------- */

const HISTORY_LIMIT_PER_USER = 1000; // PRD §35

export function listHistory(userId, limit = 30) {
  const rows = all(
    `SELECT h.track_id, h.played_at, h.position,
       t.*, ar.name AS artist_name, al.title AS album_title, al.artwork_path AS artwork_path, g.name AS genre_name
     FROM playback_history h
     JOIN tracks t        ON t.id = h.track_id
     LEFT JOIN artists ar ON ar.id = t.artist_id
     LEFT JOIN albums  al ON al.id = t.album_id
     LEFT JOIN genres  g  ON g.id  = t.genre_id
     WHERE h.user_id = ? AND t.missing = 0
     ORDER BY h.played_at DESC
     LIMIT ?`,
    [userId, Math.min(500, Math.max(1, Number(limit) || 30))],
  );
  return rows.map((row) => ({ trackId: String(row.track_id), playedAt: row.played_at, position: row.position, track: serializeTrack(row) }));
}

export function recordHistory(userId, trackId, position = 0) {
  transaction(() => {
    run(
      `INSERT INTO playback_history (user_id, track_id, played_at, position)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)
       ON CONFLICT(user_id, track_id) DO UPDATE SET
         played_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         position  = excluded.position`,
      [userId, trackId, position],
    );
    // Trim oldest rows beyond the per-user cap.
    run(
      `DELETE FROM playback_history
       WHERE user_id = ?
         AND id NOT IN (SELECT id FROM playback_history WHERE user_id = ? ORDER BY played_at DESC LIMIT ?)`,
      [userId, userId, HISTORY_LIMIT_PER_USER],
    );
  });
  return true;
}

/* --------------------------------- settings -------------------------------- */

const DEFAULT_SETTINGS = { theme: 'dark', volume: 0.8, shuffle: false, repeatMode: 'off', autoplay: true };

export function getSettings(userId) {
  const row = get('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    theme: row.theme,
    volume: row.volume,
    shuffle: Boolean(row.shuffle),
    repeatMode: row.repeat_mode,
    autoplay: Boolean(row.autoplay),
    lastTrackId: row.last_track_id != null ? String(row.last_track_id) : null,
    lastPosition: row.last_position,
  };
}

export function saveSettings(userId, patch = {}) {
  const current = getSettings(userId);
  const next = { ...current, ...patch };
  run(
    `INSERT INTO user_settings (user_id, theme, volume, shuffle, repeat_mode, autoplay, last_track_id, last_position, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(user_id) DO UPDATE SET
       theme = excluded.theme, volume = excluded.volume, shuffle = excluded.shuffle,
       repeat_mode = excluded.repeat_mode, autoplay = excluded.autoplay,
       last_track_id = excluded.last_track_id, last_position = excluded.last_position,
       updated_at = excluded.updated_at`,
    [
      userId,
      next.theme,
      next.volume,
      next.shuffle ? 1 : 0,
      next.repeatMode,
      next.autoplay ? 1 : 0,
      next.lastTrackId ? Number(next.lastTrackId) : null,
      next.lastPosition ?? 0,
    ],
  );
  return getSettings(userId);
}
