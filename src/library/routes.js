import { config } from '../config.js';
import * as repo from './repository.js';
import { requireAuth } from '../middleware/auth.js';
import { ok, notFound, badRequest } from '../utils/http.js';

function numericId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid id', 'INVALID_ID');
  return id;
}

export async function libraryRoutes(app) {
  app.addHook('preHandler', async (request) => requireAuth(request));

  app.get('/api/library', async (request, reply) => ok(reply, { ...repo.libraryStats(), libraryRoot: config.libraryPath }));

  app.get('/api/tracks', async (request, reply) => {
    const q = request.query || {};
    return ok(
      reply,
      repo.listTracks({
        page: q.page,
        limit: q.limit,
        sort: q.sort,
        order: q.order,
        q: typeof q.q === 'string' ? q.q.trim() : '',
        artistId: q.artist_id,
        albumId: q.album_id,
        genreId: q.genre_id,
      }),
    );
  });

  app.get('/api/tracks/:id', async (request, reply) => {
    const track = repo.getTrackById(numericId(request.params.id));
    if (!track) throw notFound('Track not found', 'TRACK_NOT_FOUND');
    return ok(reply, track);
  });

  app.get('/api/artists', async (request, reply) => ok(reply, repo.listArtists()));

  app.get('/api/artists/:id', async (request, reply) => {
    const artist = repo.getArtistById(numericId(request.params.id));
    if (!artist) throw notFound('Artist not found', 'ARTIST_NOT_FOUND');
    return ok(reply, artist);
  });

  app.get('/api/albums', async (request, reply) => ok(reply, repo.listAlbums()));

  app.get('/api/albums/:id', async (request, reply) => {
    const album = repo.getAlbumById(numericId(request.params.id));
    if (!album) throw notFound('Album not found', 'ALBUM_NOT_FOUND');
    return ok(reply, album);
  });

  app.get('/api/genres', async (request, reply) => ok(reply, repo.listGenres()));

  app.get('/api/search', async (request, reply) => {
    const q = String(request.query?.q || '').trim();
    if (!q) return ok(reply, { tracks: [], artists: [], albums: [], genres: [] });
    return ok(reply, repo.search(q));
  });
}
