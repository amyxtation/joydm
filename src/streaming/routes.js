import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { logger } from '../logger.js';
import * as repo from '../library/repository.js';
import { artworkFilePath } from '../indexer/artwork.js';
import { resolveLibraryPathStrict } from '../utils/paths.js';
import { requireAuth } from '../middleware/auth.js';
import { fail } from '../utils/http.js';

/**
 * Parses a single-range `Range: bytes=…` header.
 * Returns `{ start, end }` (inclusive) or null when absent/unsatisfiable.
 */
export function parseRange(header, size) {
  if (!header || typeof header !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;

  let start;
  let end;

  if (rawStart === '' && rawEnd === '') return null;
  if (rawStart === '') {
    // Suffix range: last N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function streamingRoutes(app) {
  const streamHandler = async (request, reply) => {
    requireAuth(request);

    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) return fail(reply, 404, 'TRACK_NOT_FOUND', 'Track not found');

    const track = repo.getTrackById(id);
    if (!track) return fail(reply, 404, 'TRACK_NOT_FOUND', 'Track not found');
    if (!track.available) return fail(reply, 404, 'FILE_UNAVAILABLE', 'File unavailable');

    let absolute;
    try {
      absolute = resolveLibraryPathStrict(track.filePath);
    } catch (error) {
      if (error.code === 'PATH_TRAVERSAL') {
        logger.error('path traversal attempt blocked', { trackId: track.id, filePath: track.filePath, ip: request.ip });
        return fail(reply, 403, 'FORBIDDEN', 'Forbidden');
      }
      repo.setTrackMissing(Number(track.id), true);
      return fail(reply, 404, 'FILE_UNAVAILABLE', 'File unavailable');
    }

    let stat;
    try {
      stat = await fsp.stat(absolute);
    } catch {
      repo.setTrackMissing(Number(track.id), true);
      return fail(reply, 404, 'FILE_UNAVAILABLE', 'File unavailable');
    }

    const size = stat.size;
    const range = parseRange(request.headers.range, size);

    // Unsatisfiable range: answer with JSON *before* switching the content type.
    if (request.headers.range && !range) {
      reply.header('Content-Range', `bytes */${size}`).header('Accept-Ranges', 'bytes');
      return fail(reply, 416, 'RANGE_NOT_SATISFIABLE', 'Requested range not satisfiable');
    }

    // From here on we are streaming bytes, so advertise range support and the
    // real content type (PRD §24).
    reply
      .header('Accept-Ranges', 'bytes')
      .header('Content-Type', track.mimeType)
      .header('Last-Modified', stat.mtime.toUTCString())
      .header('Cache-Control', 'private, max-age=0, must-revalidate');

    if (request.method === 'HEAD') {
      reply.header('Content-Length', String(range ? range.end - range.start + 1 : size));
      if (range) reply.code(206).header('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      return reply.send();
    }

    if (range) {
      const length = range.end - range.start + 1;
      reply.code(206).header('Content-Range', `bytes ${range.start}-${range.end}/${size}`).header('Content-Length', String(length));
      // Streamed straight from the filesystem — never buffered into memory (§24/§86).
      return reply.send(fs.createReadStream(absolute, { start: range.start, end: range.end }));
    }

    reply.header('Content-Length', String(size));
    return reply.send(fs.createReadStream(absolute));
  };

  app.get('/api/stream/:id', streamHandler);
  app.head('/api/stream/:id', streamHandler);

  /** Cached artwork (PRD §36). Only files inside the cache directory are served. */
  app.get('/api/artwork/albums/:id', async (request, reply) => {
    requireAuth(request);
    const album = repo.getAlbumRaw(Number(request.params.id));
    if (!album?.artwork_path) return fail(reply, 404, 'ARTWORK_NOT_FOUND', 'No artwork for this album');

    const file = await artworkFilePath(album.artwork_path);
    if (!file) return fail(reply, 404, 'ARTWORK_NOT_FOUND', 'No artwork for this album');

    const extension = file.split('.').pop().toLowerCase();
    const type = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'gif' ? 'image/gif' : 'image/jpeg';
    const stat = await fsp.stat(file);
    reply
      .header('Content-Type', type)
      .header('Content-Length', String(stat.size))
      .header('Cache-Control', 'private, max-age=604800, immutable');
    return reply.send(fs.createReadStream(file));
  });
}
