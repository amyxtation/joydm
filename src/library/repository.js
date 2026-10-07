/**
 * Repository layer — all SQL lives here (PRD §112/§113). Rows are serialised
 * into the exact shapes the frontend already consumes, with ids as strings
 * (matching the mock API) so view code needs no changes.
 */

import { all, get, run, transaction } from '../database/index.js';

const UNKNOWN_ARTIST = 'Unknown Artist';
const UNKNOWN_ALBUM = 'Unknown Album';

export function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formatOf(filePath) {
  const ext = String(filePath).split('.').pop() || '';
  return ext.toUpperCase();
}

export function serializeTrack(row) {
  const albumId = row.album_id != null ? String(row.album_id) : null;
  return {
    id: String(row.id),
    title: row.title,
    artistId: row.artist_id != null ? String(row.artist_id) : null,
    artist: row.artist_name || UNKNOWN_ARTIST,
    albumId,
    album: row.album_title || UNKNOWN_ALBUM,
    genreId: row.genre_id != null ? String(row.genre_id) : null,
    genre: row.genre_name || null,
    albumArtist: row.album_artist || null,
    trackNumber: row.track_number ?? null,
    discNumber: row.disc_number ?? null,
    year: row.year ?? null,
    duration: Number(row.duration) || 0,
    mimeType: row.mime_type,
    format: formatOf(row.file_path),
    fileSize: Number(row.file_size) || 0,
    filePath: row.file_path,
    addedAt: row.created_at,
    modifiedAt: row.file_modified_at || row.created_at,
    available: !row.missing,
    artworkSeed: albumId ? `al-${albumId}` : `tr-${row.id}`,
    artwork: row.artwork_path ? `/api/artwork/albums/${albumId}` : null,
  };
}

export function serializeAlbum(row, tracks = null) {
  const id = String(row.id);
  return {
    id,
    title: row.title,
    artistId: row.artist_id != null ? String(row.artist_id) : null,
    artist: row.artist_name || UNKNOWN_ARTIST,
    year: row.year ?? null,
    trackCount: Number(row.track_count) || 0,
    duration: Number(row.duration) || 0,
    artworkSeed: `al-${id}`,
    artwork: row.artwork_path ? `/api/artwork/albums/${id}` : null,
    ...(tracks ? { tracks } : {}),
  };
}

export function serializeArtist(row, albums = null) {
  const id = String(row.id);
  return {
    id,
    name: row.name,
    albumCount: Number(row.album_count) || 0,
    trackCount: Number(row.track_count) || 0,
    duration: Number(row.duration) || 0,
    ...(albums ? { albums } : {}),
  };
}

export function serializeGenre(row) {
  return {
    id: String(row.id),
    name: row.name,
    trackCount: Number(row.track_count) || 0,
    albumCount: Number(row.album_count) || 0,
  };
}

/* --------------------------------- lookups -------------------------------- */

const TRACK_COLUMNS = `
  t.*,
  ar.name  AS artist_name,
  al.title AS album_title,
  al.artwork_path AS artwork_path,
  g.name   AS genre_name
`;
const TRACK_JOINS = `
  FROM tracks t
  LEFT JOIN artists ar ON ar.id = t.artist_id
  LEFT JOIN albums  al ON al.id = t.album_id
  LEFT JOIN genres  g  ON g.id  = t.genre_id
`;

const SORT_COLUMNS = {
  title: 't.title COLLATE NOCASE',
  artist: 'ar.name COLLATE NOCASE',
  album: 'al.title COLLATE NOCASE',
  duration: 't.duration',
  addedAt: 't.created_at',
  trackNumber: 't.disc_number, t.track_number',
};

export function listTracks({ page = 1, limit = 50, sort = 'addedAt', order = 'desc', q = '', artistId, albumId, genreId, includeMissing = false } = {}) {
  const where = [];
  const params = [];

  if (!includeMissing) where.push('t.missing = 0');
  if (artistId) {
    where.push('t.artist_id = ?');
    params.push(Number(artistId));
  }
  if (albumId) {
    where.push('t.album_id = ?');
    params.push(Number(albumId));
  }
  if (genreId) {
    where.push('t.genre_id = ?');
    params.push(Number(genreId));
  }
  if (q) {
    where.push('(t.title LIKE ? OR ar.name LIKE ? OR al.title LIKE ? OR g.name LIKE ?)');
    const needle = `%${q}%`;
    params.push(needle, needle, needle, needle);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const column = SORT_COLUMNS[sort] || SORT_COLUMNS.addedAt;
  const direction = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);

  const total = get(`SELECT COUNT(*) AS n ${TRACK_JOINS} ${whereSql}`, params)?.n || 0;
  const rows = all(
    `SELECT ${TRACK_COLUMNS} ${TRACK_JOINS} ${whereSql} ORDER BY ${column} ${direction}, t.id ASC LIMIT ? OFFSET ?`,
    [...params, safeLimit, (safePage - 1) * safeLimit],
  );

  return {
    items: rows.map(serializeTrack),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      total_pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

export function getTrackById(id) {
  const row = get(`SELECT ${TRACK_COLUMNS} ${TRACK_JOINS} WHERE t.id = ?`, [Number(id)]);
  return row ? serializeTrack(row) : null;
}

export function listArtists() {
  const rows = all(`
    SELECT ar.id, ar.name,
      COUNT(DISTINCT al.id) AS album_count,
      COUNT(t.id)           AS track_count,
      COALESCE(SUM(t.duration), 0) AS duration
    FROM artists ar
    LEFT JOIN albums al ON al.artist_id = ar.id
    LEFT JOIN tracks t  ON t.artist_id = ar.id AND t.missing = 0
    GROUP BY ar.id
    HAVING track_count > 0 OR album_count > 0
    ORDER BY ar.name COLLATE NOCASE
  `);
  return rows.map((row) => serializeArtist(row));
}

export function getArtistById(id) {
  const row = get(
    `SELECT ar.id, ar.name,
       COUNT(DISTINCT al.id) AS album_count,
       COUNT(t.id)           AS track_count,
       COALESCE(SUM(t.duration), 0) AS duration
     FROM artists ar
     LEFT JOIN albums al ON al.artist_id = ar.id
     LEFT JOIN tracks t  ON t.artist_id = ar.id AND t.missing = 0
     WHERE ar.id = ?
     GROUP BY ar.id`,
    [Number(id)],
  );
  if (!row) return null;
  const albums = all(
    `SELECT al.id, al.title, al.year, al.artwork_path, al.artist_id,
       (SELECT name FROM artists WHERE id = al.artist_id) AS artist_name,
       COUNT(t.id) AS track_count,
       COALESCE(SUM(t.duration), 0) AS duration
     FROM albums al
     LEFT JOIN tracks t ON t.album_id = al.id AND t.missing = 0
     WHERE al.artist_id = ?
     GROUP BY al.id
     ORDER BY al.year, al.title COLLATE NOCASE`,
    [Number(id)],
  ).map((album) => serializeAlbum(album));
  return serializeArtist(row, albums);
}

export function listAlbums() {
  const rows = all(`
    SELECT al.id, al.title, al.year, al.artwork_path, al.artist_id,
      ar.name AS artist_name,
      COUNT(t.id) AS track_count,
      COALESCE(SUM(t.duration), 0) AS duration
    FROM albums al
    LEFT JOIN artists ar ON ar.id = al.artist_id
    LEFT JOIN tracks t   ON t.album_id = al.id AND t.missing = 0
    GROUP BY al.id
    HAVING track_count > 0
    ORDER BY al.title COLLATE NOCASE
  `);
  return rows.map((row) => serializeAlbum(row));
}

export function getAlbumById(id) {
  const row = get(
    `SELECT al.id, al.title, al.year, al.artwork_path, al.artist_id,
       ar.name AS artist_name,
       COUNT(t.id) AS track_count,
       COALESCE(SUM(t.duration), 0) AS duration
     FROM albums al
     LEFT JOIN artists ar ON ar.id = al.artist_id
     LEFT JOIN tracks t   ON t.album_id = al.id AND t.missing = 0
     WHERE al.id = ?
     GROUP BY al.id`,
    [Number(id)],
  );
  if (!row) return null;
  const tracks = all(
    `SELECT ${TRACK_COLUMNS} ${TRACK_JOINS} WHERE t.album_id = ? AND t.missing = 0
     ORDER BY t.disc_number, t.track_number, t.title COLLATE NOCASE`,
    [Number(id)],
  ).map(serializeTrack);
  return serializeAlbum(row, tracks);
}

export function listGenres() {
  const rows = all(`
    SELECT g.id, g.name,
      COUNT(t.id) AS track_count,
      COUNT(DISTINCT t.album_id) AS album_count
    FROM genres g
    LEFT JOIN tracks t ON t.genre_id = g.id AND t.missing = 0
    GROUP BY g.id
    HAVING track_count > 0
    ORDER BY g.name COLLATE NOCASE
  `);
  return rows.map(serializeGenre);
}

export function search(q) {
  const needle = `%${q}%`;
  const tracks = all(
    `SELECT ${TRACK_COLUMNS} ${TRACK_JOINS}
     WHERE t.missing = 0 AND (t.title LIKE ? OR ar.name LIKE ? OR al.title LIKE ?)
     ORDER BY t.title COLLATE NOCASE LIMIT 40`,
    [needle, needle, needle],
  ).map(serializeTrack);

  const artists = all(
    `SELECT ar.id, ar.name,
       COUNT(DISTINCT al.id) AS album_count,
       COUNT(t.id) AS track_count,
       COALESCE(SUM(t.duration), 0) AS duration
     FROM artists ar
     LEFT JOIN albums al ON al.artist_id = ar.id
     LEFT JOIN tracks t ON t.artist_id = ar.id AND t.missing = 0
     WHERE ar.name LIKE ?
     GROUP BY ar.id LIMIT 12`,
    [needle],
  ).map((row) => serializeArtist(row));

  const albums = all(
    `SELECT al.id, al.title, al.year, al.artwork_path, al.artist_id,
       ar.name AS artist_name, COUNT(t.id) AS track_count, COALESCE(SUM(t.duration), 0) AS duration
     FROM albums al
     LEFT JOIN artists ar ON ar.id = al.artist_id
     LEFT JOIN tracks t ON t.album_id = al.id AND t.missing = 0
     WHERE al.title LIKE ? OR ar.name LIKE ?
     GROUP BY al.id LIMIT 12`,
    [needle, needle],
  ).map((row) => serializeAlbum(row));

  const genres = listGenres().filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));

  return { tracks, artists, albums, genres };
}

export function libraryStats() {
  const counts = get(`
    SELECT
      (SELECT COUNT(*) FROM tracks WHERE missing = 0) AS tracks,
      (SELECT COUNT(DISTINCT artist_id) FROM tracks WHERE missing = 0 AND artist_id IS NOT NULL) AS artists,
      (SELECT COUNT(DISTINCT album_id) FROM tracks WHERE missing = 0 AND album_id IS NOT NULL) AS albums,
      (SELECT COUNT(DISTINCT genre_id) FROM tracks WHERE missing = 0 AND genre_id IS NOT NULL) AS genres,
      (SELECT COUNT(*) FROM playlists) AS playlists,
      (SELECT COALESCE(SUM(duration), 0) FROM tracks WHERE missing = 0) AS duration,
      (SELECT COALESCE(SUM(file_size), 0) FROM tracks WHERE missing = 0) AS storage
  `);
  return {
    tracks: counts.tracks,
    artists: counts.artists,
    albums: counts.albums,
    genres: counts.genres,
    playlists: counts.playlists,
    duration: counts.duration,
    storageUsedBytes: counts.storage,
  };
}

/* ------------------------------- indexer writes ---------------------------- */

export function upsertArtist(name) {
  const label = name || UNKNOWN_ARTIST;
  const normalized = normalizeName(label) || normalizeName(UNKNOWN_ARTIST);
  const existing = get('SELECT id FROM artists WHERE normalized_name = ?', [normalized]);
  if (existing) return existing.id;
  const result = run('INSERT INTO artists (name, normalized_name) VALUES (?, ?)', [label, normalized]);
  return Number(result.lastInsertRowid);
}

export function upsertAlbum(title, artistId, year) {
  const label = title || UNKNOWN_ALBUM;
  const existing = get('SELECT id, year, artwork_path FROM albums WHERE title = ? AND artist_id IS ?', [label, artistId ?? null]);
  if (existing) {
    if (year && !existing.year) run('UPDATE albums SET year = ? WHERE id = ?', [year, existing.id]);
    return existing.id;
  }
  const result = run('INSERT INTO albums (title, artist_id, year) VALUES (?, ?, ?)', [label, artistId ?? null, year ?? null]);
  return Number(result.lastInsertRowid);
}

export function upsertGenre(name) {
  if (!name) return null;
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const existing = get('SELECT id FROM genres WHERE normalized_name = ?', [normalized]);
  if (existing) return existing.id;
  const result = run('INSERT INTO genres (name, normalized_name) VALUES (?, ?)', [name, normalized]);
  return Number(result.lastInsertRowid);
}

export function findTrackByPath(filePath) {
  return get('SELECT * FROM tracks WHERE file_path = ?', [filePath]);
}

export function insertTrack(record) {
  const result = run(
    `INSERT INTO tracks
       (title, artist_id, album_id, genre_id, album_artist, track_number, disc_number, year,
        duration, file_path, file_size, mime_type, file_modified_at, missing)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      record.title,
      record.artistId ?? null,
      record.albumId ?? null,
      record.genreId ?? null,
      record.albumArtist ?? null,
      record.trackNumber ?? null,
      record.discNumber ?? null,
      record.year ?? null,
      record.duration ?? 0,
      record.filePath,
      record.fileSize ?? 0,
      record.mimeType ?? 'application/octet-stream',
      record.fileModifiedAt ?? null,
    ],
  );
  return Number(result.lastInsertRowid);
}

export function updateTrack(id, record) {
  run(
    `UPDATE tracks SET
       title = ?, artist_id = ?, album_id = ?, genre_id = ?, album_artist = ?,
       track_number = ?, disc_number = ?, year = ?, duration = ?, file_size = ?,
       mime_type = ?, file_modified_at = ?, missing = 0,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
    [
      record.title,
      record.artistId ?? null,
      record.albumId ?? null,
      record.genreId ?? null,
      record.albumArtist ?? null,
      record.trackNumber ?? null,
      record.discNumber ?? null,
      record.year ?? null,
      record.duration ?? 0,
      record.fileSize ?? 0,
      record.mimeType ?? 'application/octet-stream',
      record.fileModifiedAt ?? null,
      id,
    ],
  );
}

export function setTrackMissing(id, missing) {
  run("UPDATE tracks SET missing = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", [missing ? 1 : 0, id]);
}

export function setAlbumArtwork(albumId, artworkPath, hash) {
  run("UPDATE albums SET artwork_path = ?, artwork_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", [
    artworkPath,
    hash,
    albumId,
  ]);
}

export function getAlbumRaw(id) {
  return get('SELECT * FROM albums WHERE id = ?', [Number(id)]);
}

export function pruneOrphanedEntities() {
  transaction(() => {
    run('DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL)');
    run('DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM tracks WHERE artist_id IS NOT NULL)');
    run('DELETE FROM genres WHERE id NOT IN (SELECT DISTINCT genre_id FROM tracks WHERE genre_id IS NOT NULL)');
  });
}

export { transaction };
