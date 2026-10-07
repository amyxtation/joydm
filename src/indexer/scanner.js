import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { all, get, run } from '../database/index.js';
import * as repo from '../library/repository.js';
import { isSupportedFile, readTrackMetadata } from './metadata.js';
import { cacheArtwork, findFolderArtwork, readFolderArtwork } from './artwork.js';
import { toLibraryRelative } from '../utils/paths.js';

const state = {
  status: 'idle',
  reason: null,
  startedAt: null,
  finishedAt: null,
  total: 0,
  scanned: 0,
  added: 0,
  updated: 0,
  removed: 0,
  errors: 0,
  message: null,
};

let active = null;

export function getScanStatus() {
  return { ...state };
}

export function isScanning() {
  return state.status === 'running';
}

/** Recursively lists candidate audio files, skipping dot-directories (`.git`, etc.). */
async function walkAudioFiles(root) {
  const found = [];

  async function visit(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      state.errors += 1;
      logger.warn('scan: cannot read directory', { directory, error: error.message });
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile() && isSupportedFile(entry.name)) {
        try {
          const stat = await fs.stat(absolute);
          found.push({ absolute, stat });
        } catch {
          state.errors += 1;
        }
      }
    }
  }

  await visit(root);
  return found;
}

async function pool(items, limit, worker) {
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index], index);
      }
    }),
  );
}

/**
 * Scans the music library and reconciles it with the database (PRD §12/§13/§30).
 * Runs asynchronously; progress is readable via `getScanStatus()`.
 */
export async function runScan({ reason = 'manual', force = false } = {}) {
  if (active) return active;
  active = execute(reason, force).finally(() => {
    active = null;
  });
  return active;
}

async function execute(reason, force = false) {
  Object.assign(state, {
    status: 'running',
    reason,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    total: 0,
    scanned: 0,
    added: 0,
    updated: 0,
    removed: 0,
    errors: 0,
    message: 'Reading file system…',
  });

  const job = run("INSERT INTO scan_jobs (status, started_at, message) VALUES ('running', ?, ?)", [state.startedAt, reason]);
  const jobId = Number(job.lastInsertRowid);
  logger.info('scan started', { reason });

  try {
    const files = await walkAudioFiles(config.libraryPath);
    state.total = files.length;
    state.message = 'Reading metadata…';

    const seen = new Set();
    const artworkCandidates = new Map();

    await pool(files, config.scanConcurrency, async (file, index) => {
      const relativePath = toLibraryRelative(file.absolute);
      seen.add(relativePath);

      const modifiedIso = new Date(file.stat.mtimeMs).toISOString();
      const existing = repo.findTrackByPath(relativePath);
      const unchanged =
        !force && existing && existing.file_size === file.stat.size && existing.file_modified_at === modifiedIso && !existing.missing;

      if (unchanged) {
        state.scanned += 1;
        if (artworkCandidates.has(existing.album_id) === false && existing.album_id) {
          artworkCandidates.set(existing.album_id, { directory: path.dirname(file.absolute) });
        }
        return;
      }

      try {
        const meta = await readTrackMetadata(file.absolute, file.stat);
        // PRD §12: fall back to filename / Unknown Artist / Unknown Album.
        const artistId = repo.upsertArtist(meta.artist || 'Unknown Artist');
        const albumArtistId = meta.albumArtist ? repo.upsertArtist(meta.albumArtist) : artistId;
        const albumId = repo.upsertAlbum(meta.album || 'Unknown Album', albumArtistId, meta.year);
        const genreId = meta.genre ? repo.upsertGenre(meta.genre) : null;

        const record = {
          title: meta.title,
          artistId,
          albumId,
          genreId,
          albumArtist: meta.albumArtist,
          trackNumber: meta.trackNumber,
          discNumber: meta.discNumber,
          year: meta.year,
          duration: meta.duration,
          filePath: relativePath,
          fileSize: meta.fileSize,
          mimeType: meta.mimeType,
          fileModifiedAt: meta.modifiedAt,
        };

        if (existing) {
          repo.updateTrack(existing.id, record);
          state.updated += 1;
        } else {
          repo.insertTrack(record);
          state.added += 1;
        }

        const candidate = artworkCandidates.get(albumId);
        if (!candidate || (!candidate.cover && meta.cover)) {
          artworkCandidates.set(albumId, {
            directory: path.dirname(file.absolute),
            cover: meta.cover || candidate?.cover || null,
          });
        }
      } catch (error) {
        state.errors += 1;
        logger.warn('scan: skipping file', { file: relativePath, error: error.message });
      } finally {
        state.scanned += 1;
      }

      if (index % 25 === 0) {
        persistProgress(jobId);
        // Yield so streaming requests keep priority over the scan (PRD §117).
        await new Promise((resolve) => setImmediate(resolve));
      }
    });

    // Reconcile deletions (PRD §12/§130).
    state.message = 'Reconciling library…';
    const knownTracks = all('SELECT id, file_path FROM tracks WHERE missing = 0');
    for (const track of knownTracks) {
      if (!seen.has(track.file_path)) {
        repo.setTrackMissing(track.id, true);
        state.removed += 1;
      }
    }

    state.message = 'Caching artwork…';
    await pool([...artworkCandidates.entries()], Math.min(2, config.scanConcurrency), async ([albumId, candidate]) => {
      try {
        const album = repo.getAlbumRaw(albumId);
        if (!album) return;

        let source = candidate.cover;
        if (!source) {
          const folderFile = await findFolderArtwork(candidate.directory);
          if (folderFile) source = await readFolderArtwork(folderFile);
        }
        if (!source?.buffer?.length) return;

        const cached = await cacheArtwork(albumId, {
          buffer: source.buffer,
          format: source.format,
          previousHash: album.artwork_hash,
        });
        if (cached) repo.setAlbumArtwork(albumId, cached.filename, cached.hash);
      } catch (error) {
        state.errors += 1;
        logger.warn('scan: artwork failed', { albumId, error: error.message });
      }
    });

    repo.pruneOrphanedEntities();

    state.status = 'idle';
    state.message = 'Scan complete';
    state.finishedAt = new Date().toISOString();
    persistProgress(jobId, 'complete');
    logger.info('scan complete', {
      reason,
      total: state.total,
      added: state.added,
      updated: state.updated,
      removed: state.removed,
      errors: state.errors,
    });
  } catch (error) {
    state.status = 'error';
    state.message = error.message;
    state.finishedAt = new Date().toISOString();
    persistProgress(jobId, 'error');
    logger.error('scan failed', { reason, error: error.message });
  }

  return getScanStatus();
}

function persistProgress(jobId, status = 'running') {
  run(
    `UPDATE scan_jobs SET status = ?, scanned = ?, total = ?, indexed = ?, removed = ?, errors = ?, message = ?,
       finished_at = CASE WHEN ? = 'running' THEN NULL ELSE ? END
     WHERE id = ?`,
    [
      status,
      state.scanned,
      state.total,
      state.added + state.updated,
      state.removed,
      state.errors,
      state.message,
      status,
      state.finishedAt,
      jobId,
    ],
  );
}
