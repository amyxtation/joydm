/**
 * API layer.
 *
 * Every function mirrors a documented REST endpoint from the PRD (see §41–§47).
 * `USE_MOCK` is false now that the Fastify backend is in place; the mock branch
 * is kept so the UI can still be developed standalone (set it to true).
 *
 * Responses use the PRD envelope `{ success, data, error }`.
 */

import {
  mockTracks,
  mockArtists,
  mockAlbums,
  mockGenres,
  mockPlaylists,
  mockHistory,
  mockUser,
  mockUsers,
  mockSystem,
  LIBRARY_ROOT,
} from '../data/mock.js';
import { persisted } from '../core/store.js';
import { uid } from '../core/utils.js';

export const USE_MOCK = false;

const LATENCY = 90;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  if (status) error.status = status;
  return error;
}

/* ------------------------------- mock "db" ------------------------------- */

const db = {
  favorites: new Set(persisted.read('favorites', ['tr-001', 'tr-014', 'tr-028', 'tr-041'])),
  playlists: persisted.read('playlists', mockPlaylists),
  history: persisted.read('history', mockHistory),
  settings: persisted.read('settings', { theme: 'dark', autoplay: true, crossfade: 0 }),
  session: persisted.read('session', mockUser),
};

function saveFavorites() {
  persisted.write('favorites', [...db.favorites]);
}
function savePlaylists() {
  persisted.write('playlists', db.playlists);
}
function saveHistory() {
  persisted.write('history', db.history);
}

function withPlaylistTracks(playlist) {
  const byId = new Map(mockTracks.map((t) => [t.id, t]));
  const tracks = playlist.trackIds.map((id) => byId.get(id)).filter(Boolean);
  return {
    ...playlist,
    tracks,
    trackCount: tracks.length,
    duration: tracks.reduce((sum, t) => sum + t.duration, 0),
  };
}

/* --------------------------------- real API -------------------------------- */

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    const offline = new Error('Cannot reach the JoyDM API. Is the server running?');
    offline.code = 'API_UNREACHABLE';
    throw offline;
  }

  const payload = await res.json().catch(() => null);

  if (!payload?.success) {
    const fallback = res.ok
      ? 'The JoyDM API returned an unexpected response.'
      : `JoyDM API request failed (HTTP ${res.status}). Is the server running?`;
    const error = new Error(payload?.error?.message || fallback);
    error.code = payload?.error?.code || `HTTP_${res.status}`;
    error.status = res.status;
    throw error;
  }
  return payload.data;
}

/* --------------------------------- surface -------------------------------- */

export const api = {
  libraryRoot: LIBRARY_ROOT,

  auth: {
    async status() {
      if (USE_MOCK) return { setupRequired: false, privateMode: false };
      return request('/api/auth/status');
    },
    async setup({ username, password }) {
      if (USE_MOCK) return this.login({ username, password });
      return request('/api/auth/setup', { method: 'POST', body: { username, password } });
    },
    async me() {
      if (USE_MOCK) {
        await sleep(LATENCY);
        return db.session;
      }
      return request('/api/auth/me');
    },
    async login({ username, password }) {
      if (USE_MOCK) {
        await sleep(360);
        if (!username || !password) throw new Error('Username and password are required.');
        if (password.length < 4) {
          const err = new Error('Invalid username or password.');
          err.code = 'INVALID_CREDENTIALS';
          throw err;
        }
        db.session = { ...mockUser, username, lastLoginAt: new Date().toISOString() };
        persisted.write('session', db.session);
        return db.session;
      }
      return request('/api/auth/login', { method: 'POST', body: { username, password } });
    },
    async logout() {
      if (USE_MOCK) {
        await sleep(120);
        db.session = null;
        persisted.write('session', null);
        return true;
      }
      return request('/api/auth/logout', { method: 'POST' });
    },
  },

  library: {
    async stats() {
      if (USE_MOCK) {
        await sleep(LATENCY);
        const totalBytes = mockTracks.reduce((sum, t) => sum + t.fileSize, 0);
        return {
          tracks: mockTracks.length,
          artists: mockArtists.length,
          albums: mockAlbums.length,
          genres: mockGenres.length,
          playlists: db.playlists.length,
          duration: mockTracks.reduce((sum, t) => sum + t.duration, 0),
          storageUsedBytes: totalBytes,
          libraryRoot: LIBRARY_ROOT,
        };
      }
      return request('/api/library');
    },

    async tracks({ page = 1, limit = 50, sort = 'addedAt', order = 'desc', q = '', artistId, albumId, genreId, favoriteIds } = {}) {
      if (!USE_MOCK) {
        const params = new URLSearchParams({ page, limit, sort, order });
        if (q) params.set('q', q);
        if (artistId) params.set('artist_id', artistId);
        if (albumId) params.set('album_id', albumId);
        if (genreId) params.set('genre_id', genreId);
        return request(`/api/tracks?${params}`);
      }

      await sleep(LATENCY);
      let items = mockTracks.slice();

      if (artistId) items = items.filter((t) => t.artistId === artistId);
      if (albumId) items = items.filter((t) => t.albumId === albumId);
      if (genreId) items = items.filter((t) => t.genreId === genreId);
      if (favoriteIds) items = items.filter((t) => favoriteIds.includes(t.id));
      if (q) {
        const needle = q.toLowerCase();
        items = items.filter(
          (t) =>
            t.title.toLowerCase().includes(needle) ||
            t.artist.toLowerCase().includes(needle) ||
            t.album.toLowerCase().includes(needle),
        );
      }

      const dir = order === 'asc' ? 1 : -1;
      const sorters = {
        title: (a, b) => a.title.localeCompare(b.title) * dir,
        artist: (a, b) => a.artist.localeCompare(b.artist) * dir || a.album.localeCompare(b.album),
        album: (a, b) => a.album.localeCompare(b.album) * dir || a.trackNumber - b.trackNumber,
        duration: (a, b) => (a.duration - b.duration) * dir,
        addedAt: (a, b) => (new Date(a.addedAt) - new Date(b.addedAt)) * dir,
        trackNumber: (a, b) => a.trackNumber - b.trackNumber,
      };
      items.sort(sorters[sort] || sorters.addedAt);

      const total = items.length;
      const start = (page - 1) * limit;
      return {
        items: items.slice(start, start + limit),
        pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
      };
    },

    async track(id) {
      if (USE_MOCK) {
        await sleep(60);
        return mockTracks.find((t) => t.id === id) || null;
      }
      return request(`/api/tracks/${id}`);
    },

    async artists() {
      if (USE_MOCK) {
        await sleep(LATENCY);
        return mockArtists;
      }
      return request('/api/artists');
    },

    async artist(id) {
      if (USE_MOCK) {
        await sleep(LATENCY);
        return mockArtists.find((a) => a.id === id) || null;
      }
      return request(`/api/artists/${id}`);
    },

    async albums() {
      if (USE_MOCK) {
        await sleep(LATENCY);
        return mockAlbums;
      }
      return request('/api/albums');
    },

    async album(id) {
      if (USE_MOCK) {
        await sleep(LATENCY);
        const album = mockAlbums.find((a) => a.id === id);
        if (!album) return null;
        return { ...album, tracks: mockTracks.filter((t) => t.albumId === id).sort((a, b) => a.trackNumber - b.trackNumber) };
      }
      return request(`/api/albums/${id}`);
    },

    async genres() {
      if (USE_MOCK) {
        await sleep(LATENCY);
        return mockGenres;
      }
      return request('/api/genres');
    },

    async search(q) {
      if (USE_MOCK) {
        await sleep(LATENCY);
        const needle = q.trim().toLowerCase();
        if (!needle) return { tracks: [], artists: [], albums: [], genres: [] };
        const match = (value) => value.toLowerCase().includes(needle);
        return {
          tracks: mockTracks.filter((t) => match(t.title) || match(t.artist) || match(t.album)).slice(0, 40),
          artists: mockArtists.filter((a) => match(a.name)).slice(0, 12),
          albums: mockAlbums.filter((a) => match(a.title) || match(a.artist)).slice(0, 12),
          genres: mockGenres.filter((g) => match(g.name)),
        };
      }
      return request(`/api/search?q=${encodeURIComponent(q)}`);
    },
  },

  playlists: {
    async list() {
      if (USE_MOCK) {
        await sleep(LATENCY);
        return db.playlists.map((p) => {
          const full = withPlaylistTracks(p);
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            trackCount: full.trackCount,
            duration: full.duration,
            updatedAt: p.updatedAt,
            artworkSeed: full.tracks[0]?.artworkSeed || p.id,
          };
        });
      }
      return request('/api/playlists');
    },

    async get(id) {
      if (USE_MOCK) {
        await sleep(LATENCY);
        const playlist = db.playlists.find((p) => p.id === id);
        return playlist ? withPlaylistTracks(playlist) : null;
      }
      return request(`/api/playlists/${id}`);
    },

    async create({ name, description = '', trackIds = [] }) {
      if (USE_MOCK) {
        await sleep(140);
        const playlist = {
          id: uid('pl'),
          name,
          description,
          trackIds,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.playlists = [playlist, ...db.playlists];
        savePlaylists();
        return withPlaylistTracks(playlist);
      }
      return request('/api/playlists', { method: 'POST', body: { name, description, track_ids: trackIds } });
    },

    async update(id, { name, description }) {
      if (USE_MOCK) {
        await sleep(120);
        const playlist = db.playlists.find((p) => p.id === id);
        if (!playlist) throw new Error('Playlist not found');
        if (name != null) playlist.name = name;
        if (description != null) playlist.description = description;
        playlist.updatedAt = new Date().toISOString();
        savePlaylists();
        return withPlaylistTracks(playlist);
      }
      return request(`/api/playlists/${id}`, { method: 'PUT', body: { name, description } });
    },

    async remove(id) {
      if (USE_MOCK) {
        await sleep(120);
        db.playlists = db.playlists.filter((p) => p.id !== id);
        savePlaylists();
        return true;
      }
      return request(`/api/playlists/${id}`, { method: 'DELETE' });
    },

    async addTrack(id, trackId) {
      if (USE_MOCK) {
        await sleep(110);
        const playlist = db.playlists.find((p) => p.id === id);
        if (!playlist) throw new Error('Playlist not found');
        if (!playlist.trackIds.includes(trackId)) playlist.trackIds.push(trackId);
        playlist.updatedAt = new Date().toISOString();
        savePlaylists();
        return withPlaylistTracks(playlist);
      }
      return request(`/api/playlists/${id}/tracks`, { method: 'POST', body: { track_id: trackId } });
    },

    async removeTrack(id, trackId) {
      if (USE_MOCK) {
        await sleep(110);
        const playlist = db.playlists.find((p) => p.id === id);
        if (!playlist) throw new Error('Playlist not found');
        playlist.trackIds = playlist.trackIds.filter((t) => t !== trackId);
        playlist.updatedAt = new Date().toISOString();
        savePlaylists();
        return withPlaylistTracks(playlist);
      }
      return request(`/api/playlists/${id}/tracks/${trackId}`, { method: 'DELETE' });
    },

    async reorder(id, trackIds) {
      if (USE_MOCK) {
        await sleep(90);
        const playlist = db.playlists.find((p) => p.id === id);
        if (!playlist) throw new Error('Playlist not found');
        playlist.trackIds = trackIds;
        playlist.updatedAt = new Date().toISOString();
        savePlaylists();
        return withPlaylistTracks(playlist);
      }
      return request(`/api/playlists/${id}/reorder`, { method: 'PUT', body: { track_ids: trackIds } });
    },
  },

  favorites: {
    async list() {
      if (USE_MOCK) {
        await sleep(LATENCY);
        const ids = [...db.favorites];
        const byId = new Map(mockTracks.map((t) => [t.id, t]));
        return ids.map((id) => byId.get(id)).filter(Boolean);
      }
      return request('/api/favorites');
    },
    async add(trackId) {
      if (USE_MOCK) {
        await sleep(60);
        db.favorites.add(trackId);
        saveFavorites();
        return [...db.favorites];
      }
      return request(`/api/favorites/${trackId}`, { method: 'POST' });
    },
    async remove(trackId) {
      if (USE_MOCK) {
        await sleep(60);
        db.favorites.delete(trackId);
        saveFavorites();
        return [...db.favorites];
      }
      return request(`/api/favorites/${trackId}`, { method: 'DELETE' });
    },
  },

  history: {
    async list(limit = 30) {
      if (USE_MOCK) {
        await sleep(LATENCY);
        const byId = new Map(mockTracks.map((t) => [t.id, t]));
        return db.history.slice(0, limit).map((h) => ({ ...h, track: byId.get(h.trackId) })).filter((h) => h.track);
      }
      return request(`/api/history?limit=${limit}`);
    },
    async record({ trackId, position }) {
      if (USE_MOCK) {
        db.history = [
          { trackId, position, playedAt: new Date().toISOString() },
          ...db.history.filter((h) => h.trackId !== trackId),
        ].slice(0, 1000);
        saveHistory();
        return true;
      }
      return request('/api/history', { method: 'POST', body: { track_id: trackId, position } });
    },
  },

  admin: {
    async systemStatus() {
      if (USE_MOCK) {
        await sleep(LATENCY);
        return { ...mockSystem, uptimeSeconds: mockSystem.uptimeSeconds + Math.floor(performance.now() / 1000) };
      }
      return request('/api/admin/system/status');
    },
    async scan({ force = false } = {}) {
      if (USE_MOCK) {
        await sleep(200);
        return { jobId: uid('scan'), status: 'running', startedAt: new Date().toISOString() };
      }
      return request(`/api/admin/library/scan${force ? '?force=1' : ''}`, { method: 'POST' });
    },
    async scanStatus() {
      if (USE_MOCK) return { status: 'idle', scanned: 0, total: mockTracks.length, errors: 0 };
      return request('/api/admin/library/scan/status');
    },
    async clearCache() {
      if (USE_MOCK) {
        await sleep(120);
        return { removed: 0 };
      }
      return request('/api/admin/cache/clear', { method: 'POST' });
    },
    async cleanupMissing() {
      if (USE_MOCK) {
        await sleep(120);
        return { removed: 0 };
      }
      return request('/api/admin/library/cleanup-missing', { method: 'POST' });
    },
    async users() {
      if (USE_MOCK) {
        await sleep(LATENCY);
        return mockUsers;
      }
      return request('/api/admin/users');
    },
    async createUser({ username, password, role = 'user' }) {
      if (USE_MOCK) {
        if (password && password.length < 8) {
          throw httpError('WEAK_PASSWORD', 'Password must be at least 8 characters.');
        }
        await sleep(140);
        const user = { id: uid('u'), username, role, lastLoginAt: null };
        mockUsers.push(user);
        return user;
      }
      return request('/api/admin/users', { method: 'POST', body: { username, password, role } });
    },
    async updateUser(id, patch) {
      if (USE_MOCK) {
        await sleep(120);
        const user = mockUsers.find((u) => u.id === id);
        if (!user) throw new Error('User not found');
        Object.assign(user, patch);
        return user;
      }
      return request(`/api/admin/users/${id}`, { method: 'PUT', body: patch });
    },
    async deleteUser(id) {
      if (USE_MOCK) {
        await sleep(120);
        const index = mockUsers.findIndex((u) => u.id === id);
        if (index >= 0) mockUsers.splice(index, 1);
        return true;
      }
      return request(`/api/admin/users/${id}`, { method: 'DELETE' });
    },
  },

  settings: {
    async get() {
      if (USE_MOCK) return db.settings;
      return request('/api/settings');
    },
    async save(patch) {
      if (USE_MOCK) {
        db.settings = { ...db.settings, ...patch };
        persisted.write('settings', db.settings);
        return db.settings;
      }
      return request('/api/settings', { method: 'PUT', body: patch });
    },
  },
};
