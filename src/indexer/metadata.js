import path from 'node:path';
import { parseFile } from 'music-metadata';

/** Formats the MVP supports (PRD §10). Everything else is ignored (§80). */
export const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.flac']);

export const MIME_BY_EXTENSION = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
};

export function isSupportedFile(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function mimeFor(filePath) {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function firstString(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return String(value[0]);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * Reads tags for one file. Never throws: a corrupt/unreadable file falls back
 * to filename-derived metadata so a single bad file cannot fail a scan (§79).
 */
export async function readTrackMetadata(absolutePath, stat) {
  const extension = path.extname(absolutePath).toLowerCase();
  const filename = path.basename(absolutePath, extension);

  const record = {
    title: filename,
    artist: null,
    albumArtist: null,
    album: null,
    genre: null,
    trackNumber: null,
    discNumber: null,
    year: null,
    duration: 0,
    mimeType: mimeFor(absolutePath),
    fileSize: stat.size,
    modifiedAt: new Date(stat.mtimeMs).toISOString(),
    cover: null,
    parsed: false,
  };

  try {
    const { common, format } = await parseFile(absolutePath, { duration: true, skipCovers: false });
    record.parsed = true;
    record.title = firstString(common.title) || filename;
    record.artist = firstString(common.artist, common.albumartist);
    record.albumArtist = firstString(common.albumartist, common.artist);
    record.album = firstString(common.album);
    record.genre = firstString(common.genre);
    record.trackNumber = firstNumber(common.track?.no);
    record.discNumber = firstNumber(common.disk?.no);
    record.year = firstNumber(common.year) ?? (common.date ? Number(String(common.date).slice(0, 4)) : null);
    record.duration = Number(format?.duration) || 0;

    const picture = common.picture?.[0];
    if (picture?.data) {
      record.cover = { data: Buffer.from(picture.data), format: picture.format || 'image/jpeg' };
    }
  } catch {
    // Fallback metadata already set; duration stays 0.
  }

  return record;
}
