import * as userRepo from './repository.js';
import * as libraryRepo from '../library/repository.js';
import { requireAuth } from '../middleware/auth.js';
import { ok, notFound, badRequest } from '../utils/http.js';

function numericId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${label}`, 'INVALID_ID');
  return id;
}

function requireTrack(id) {
  const track = libraryRepo.getTrackById(numericId(id, 'track id'));
  if (!track) throw notFound('Track not found', 'TRACK_NOT_FOUND');
  return track;
}

function requirePlaylist(userId, id) {
  const playlist = userRepo.getPlaylist(userId, numericId(id, 'playlist id'));
  if (!playlist) throw notFound('Playlist not found', 'PLAYLIST_NOT_FOUND');
  return playlist;
}

export async function userRoutes(app) {
  app.addHook('preHandler', async (request) => requireAuth(request));

  /* ------------------------------- playlists ------------------------------ */

  app.get('/api/playlists', async (request, reply) => ok(reply, userRepo.listPlaylists(request.user.id)));

  app.post('/api/playlists', async (request, reply) => {
    const body = request.body || {};
    const name = String(body.name || '').trim();
    if (!name) throw badRequest('Playlist name is required', 'INVALID_NAME');
    if (name.length > 120) throw badRequest('Playlist name is too long', 'INVALID_NAME');

    const trackIds = Array.isArray(body.track_ids) ? body.track_ids.map(Number).filter(Number.isInteger) : [];
    const playlist = userRepo.createPlaylist(request.user.id, {
      name,
      description: String(body.description || '').slice(0, 500),
      trackIds,
    });
    return ok(reply, playlist, 201);
  });

  app.get('/api/playlists/:id', async (request, reply) => ok(reply, requirePlaylist(request.user.id, request.params.id)));

  app.put('/api/playlists/:id', async (request, reply) => {
    const id = numericId(request.params.id, 'playlist id');
    requirePlaylist(request.user.id, id);
    const body = request.body || {};
    const patch = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) throw badRequest('Playlist name is required', 'INVALID_NAME');
      patch.name = name.slice(0, 120);
    }
    if (body.description != null) patch.description = String(body.description).slice(0, 500);
    return ok(reply, userRepo.updatePlaylist(request.user.id, id, patch));
  });

  app.delete('/api/playlists/:id', async (request, reply) => {
    const id = numericId(request.params.id, 'playlist id');
    requirePlaylist(request.user.id, id);
    userRepo.deletePlaylist(request.user.id, id);
    return ok(reply, { deleted: true });
  });

  app.post('/api/playlists/:id/tracks', async (request, reply) => {
    const id = numericId(request.params.id, 'playlist id');
    requirePlaylist(request.user.id, id);
    const track = requireTrack(request.body?.track_id);
    return ok(reply, userRepo.addPlaylistTrack(request.user.id, id, Number(track.id)));
  });

  app.delete('/api/playlists/:id/tracks/:trackId', async (request, reply) => {
    const id = numericId(request.params.id, 'playlist id');
    requirePlaylist(request.user.id, id);
    const trackId = numericId(request.params.trackId, 'track id');
    return ok(reply, userRepo.removePlaylistTrack(request.user.id, id, trackId));
  });

  app.put('/api/playlists/:id/reorder', async (request, reply) => {
    const id = numericId(request.params.id, 'playlist id');
    requirePlaylist(request.user.id, id);
    const trackIds = Array.isArray(request.body?.track_ids) ? request.body.track_ids.map(Number).filter(Number.isInteger) : null;
    if (!trackIds) throw badRequest('track_ids array is required', 'INVALID_BODY');
    return ok(reply, userRepo.reorderPlaylist(request.user.id, id, trackIds));
  });

  /* ------------------------------- favourites ----------------------------- */

  app.get('/api/favorites', async (request, reply) => ok(reply, userRepo.listFavorites(request.user.id)));

  app.post('/api/favorites/:trackId', async (request, reply) => {
    requireTrack(request.params.trackId);
    return ok(reply, userRepo.addFavorite(request.user.id, numericId(request.params.trackId, 'track id')));
  });

  app.delete('/api/favorites/:trackId', async (request, reply) =>
    ok(reply, userRepo.removeFavorite(request.user.id, numericId(request.params.trackId, 'track id'))),
  );

  /* -------------------------------- history ------------------------------- */

  app.get('/api/history', async (request, reply) => ok(reply, userRepo.listHistory(request.user.id, request.query?.limit)));

  app.post('/api/history', async (request, reply) => {
    const track = requireTrack(request.body?.track_id);
    const position = Number(request.body?.position) || 0;
    userRepo.recordHistory(request.user.id, Number(track.id), position);
    return ok(reply, { recorded: true });
  });

  /* -------------------------------- settings ------------------------------ */

  app.get('/api/settings', async (request, reply) => ok(reply, userRepo.getSettings(request.user.id)));

  app.put('/api/settings', async (request, reply) => {
    const body = request.body || {};
    const patch = {};
    if (body.theme != null) {
      const theme = String(body.theme);
      if (!['dark', 'light'].includes(theme)) throw badRequest('Invalid theme', 'INVALID_THEME');
      patch.theme = theme;
    }
    if (body.volume != null) patch.volume = Math.min(1, Math.max(0, Number(body.volume) || 0));
    if (body.shuffle != null) patch.shuffle = Boolean(body.shuffle);
    if (body.repeatMode != null) {
      const mode = String(body.repeatMode);
      if (!['off', 'all', 'one'].includes(mode)) throw badRequest('Invalid repeat mode', 'INVALID_REPEAT');
      patch.repeatMode = mode;
    }
    if (body.autoplay != null) patch.autoplay = Boolean(body.autoplay);
    if (body.lastTrackId != null) patch.lastTrackId = body.lastTrackId;
    if (body.lastPosition != null) patch.lastPosition = Number(body.lastPosition) || 0;
    return ok(reply, userRepo.saveSettings(request.user.id, patch));
  });
}
