/**
 * Application controller: owns the reactive store, the shared action set and
 * the global `[data-action]` event dispatch that views and components use.
 */

import { createStore, persisted } from './core/store.js';
import { api } from './core/api.js';
import { player } from './core/player.js';
import { icon } from './core/icons.js';
import { toast } from './ui/toast.js';
import { confirmDialog, promptDialog, openSheet } from './ui/sheet.js';
import { openContextMenu } from './ui/contextMenu.js';
import { artworkMarkup } from './ui/artwork.js';
import { escapeHtml } from './core/utils.js';

const THEME_KEY = 'theme';

const store = createStore({
  theme: persisted.read(THEME_KEY, 'dark'),
  routePath: location.pathname,
  user: null,
  favorites: new Set(),
  favoriteIds: [],
  playlists: [],
  stats: null,
  libraryRoot: '/music-library/',
  sidebarOpen: false,
  queueOpen: false,
  ready: false,
});

const trackIndex = new Map();
const viewActions = {};

let playContext = [];

export const app = {
  store,
  player,
  router: null,
  get playContext() {
    return playContext;
  },

  /* --------------------------------- setup -------------------------------- */

  async init() {
    applyTheme(store.get().theme);
    await this.refreshSession();
    return { user: store.get().user };
  },

  /** Loads library-wide data needed by the shell (stats, playlists, favorites). */
  async loadShared() {
    const [stats, playlists, favoriteTracks, settings] = await Promise.all([
      api.library.stats().catch(() => null),
      api.playlists.list().catch(() => []),
      api.favorites.list().catch(() => []),
      api.settings.get().catch(() => null),
    ]);
    const favoriteIds = favoriteTracks.map((t) => t.id);
    favoriteTracks.forEach((track) => this.indexTrack(track));
    if (settings) this.applySettings(settings);
    store.set({
      stats,
      playlists,
      favoriteIds,
      favorites: new Set(favoriteIds),
      libraryRoot: stats?.libraryRoot || store.get().libraryRoot,
      ready: true,
    });
  },

  async refreshSession() {
    try {
      const user = await api.auth.me();
      store.update('user', user);
      return user;
    } catch {
      store.update('user', null);
      return null;
    }
  },

  /* ------------------------------- collections ----------------------------- */

  indexTrack(track) {
    if (track?.id) trackIndex.set(track.id, track);
    return track;
  },

  indexTracks(tracks = []) {
    tracks.forEach((t) => trackIndex.set(t.id, t));
    return tracks;
  },

  getTrack(id) {
    return trackIndex.get(id) || null;
  },

  setPlayContext(tracks = []) {
    playContext = this.indexTracks(tracks);
    return playContext;
  },

  isFavorite(id) {
    return store.get().favorites.has(id);
  },

  async resolveCollection(kind, id) {
    switch (kind) {
      case 'songs': {
        const res = await api.library.tracks({ page: 1, limit: 200, sort: 'addedAt', order: 'desc' });
        return res.items;
      }
      case 'album':
        return (await api.library.album(id))?.tracks || [];
      case 'artist': {
        const res = await api.library.tracks({ artistId: id, limit: 200, sort: 'album' });
        return res.items;
      }
      case 'genre': {
        const res = await api.library.tracks({ genreId: id, limit: 200, sort: 'album' });
        return res.items;
      }
      case 'playlist':
        return (await api.playlists.get(id))?.tracks || [];
      case 'favorites':
        return api.favorites.list();
      case 'recent': {
        const history = await api.history.list();
        return history.map((h) => h.track);
      }
      default:
        return [];
    }
  },

  /* --------------------------------- playback ----------------------------- */

  playTrack(track, queue = null) {
    this.indexTrack(track);
    if (queue?.length) this.setPlayContext(queue);
    else if (playContext.length) {
      queue = playContext;
    }
    player.play(track, queue);
    player.resume();
  },

  playIndex(index) {
    const track = playContext[index];
    if (!track) return;
    player.playQueue(playContext, index);
  },

  async playCollection(kind, id, { shuffle = false } = {}) {
    const tracks = await this.resolveCollection(kind, id);
    if (!tracks.length) {
      toast('Nothing to play here yet.', { type: 'error' });
      return;
    }
    this.setPlayContext(tracks);
    if (shuffle) {
      player.playQueue(tracks, 0);
      if (!player.state.shuffle) player.toggleShuffle();
    } else {
      player.playQueue(tracks, 0);
    }
  },

  addToQueue(track, { next = false, silent = false } = {}) {
    this.indexTrack(track);
    player.addToQueue(track, { next });
    if (!silent) toast(next ? 'Playing next.' : 'Added to queue.', { type: 'success' });
  },

  addManyToQueue(tracks, { next = false } = {}) {
    player.addManyToQueue(tracks, { next });
    toast(`${tracks.length} track${tracks.length === 1 ? '' : 's'} added to queue.`, { type: 'success' });
  },

  /* -------------------------------- favorites ----------------------------- */

  async toggleFavorite(trackId) {
    const isFav = this.isFavorite(trackId);
    try {
      if (isFav) await api.favorites.remove(trackId);
      else await api.favorites.add(trackId);
      const favorites = new Set(store.get().favorites);
      if (isFav) favorites.delete(trackId);
      else favorites.add(trackId);
      store.set({ favorites, favoriteIds: [...favorites] });
      this.syncFavoriteDom(trackId, !isFav);
      player.patchTrack(trackId, { favorite: !isFav });
      if (!isFav) toast('Added to Favorites.', { type: 'success' });
    } catch (error) {
      toast(error.message || 'Could not update favorites.', { type: 'error' });
    }
  },

  syncFavoriteDom(trackId, favorite) {
    document.querySelectorAll(`[data-action="toggle-fav"][data-track-id="${trackId}"]`).forEach((btn) => {
      btn.classList.toggle('is-fav', favorite);
      btn.setAttribute('aria-pressed', String(favorite));
      btn.setAttribute('aria-label', favorite ? 'Remove from favorites' : 'Add to favorites');
      btn.innerHTML = icon('heart', { fill: favorite });
    });
  },

  /* -------------------------------- playlists ----------------------------- */

  async refreshPlaylists() {
    const playlists = await api.playlists.list();
    store.update('playlists', playlists);
    return playlists;
  },

  async createPlaylist({ name, description = '', trackIds = [] }) {
    const playlist = await api.playlists.create({ name, description, trackIds });
    await this.refreshPlaylists();
    toast(`Created “${playlist.name}”.`, { type: 'success' });
    return playlist;
  },

  /** Opens the "add to playlist" chooser for one or more tracks. */
  async addToPlaylistFlow(trackIds) {
    const ids = [].concat(trackIds);
    const playlists = store.get().playlists;
    const listHtml = playlists.length
      ? playlists
          .map(
            (p) => `
        <button class="result" type="button" data-pick="${p.id}" style="width:100%;text-align:left">
          ${artworkMarkup({ seed: p.artworkSeed || p.id, label: p.name, className: 'artwork--sm' })}
          <span class="result__body"><span class="result__title truncate" style="display:block">${escapeHtml(p.name)}</span>
          <span class="result__sub">${p.trackCount} track${p.trackCount === 1 ? '' : 's'}</span></span>
          ${icon('plus')}
        </button>`,
          )
          .join('')
      : '<p class="dim" style="padding:8px 4px">No playlists yet.</p>';

    const sheet = openSheet({
      title: `Add ${ids.length > 1 ? `${ids.length} tracks` : 'to playlist'}`,
      body: `<div class="result-list">${listHtml}</div>`,
      footer: `<button class="btn btn--primary" type="button" data-new>${icon('plus')} New playlist</button>`,
    });

    sheet.panel.querySelector('[data-new]').addEventListener('click', async () => {
      sheet.close();
      const name = await promptDialog({ title: 'New playlist', label: 'Name', placeholder: 'My playlist' });
      if (!name) return;
      const playlist = await this.createPlaylist({ name, trackIds: ids });
      this.router?.navigate(`/playlists/${playlist.id}`);
    });

    sheet.panel.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const playlistId = btn.dataset.pick;
        try {
          for (const id of ids) await api.playlists.addTrack(playlistId, id);
          await this.refreshPlaylists();
          sheet.close();
          toast(`Added to playlist.`, { type: 'success' });
        } catch (error) {
          toast(error.message || 'Could not add to playlist.', { type: 'error' });
        }
      });
    });
  },

  /* ------------------------------ track menus ----------------------------- */

  openTrackMenu(trackId, anchor) {
    const track = this.getTrack(trackId);
    if (!track) return;
    const element = anchor instanceof Element ? anchor : anchor?.target?.closest?.('[data-track-id]') || anchor?.target;
    const favorite = this.isFavorite(trackId);
    const playlists = store.get().playlists;
    const items = [
      { header: true, label: escapeHtml(track.title) },
      { label: 'Play now', icon: icon('play'), onClick: () => this.playTrack(track) },
      { label: 'Play next', icon: icon('queue'), onClick: () => this.addToQueue(track, { next: true }) },
      { label: 'Add to queue', icon: icon('list'), onClick: () => this.addToQueue(track) },
      { label: favorite ? 'Remove from favorites' : 'Add to favorites', icon: icon('heart'), onClick: () => this.toggleFavorite(trackId) },
      '-',
      { label: 'Add to playlist', icon: icon('plus'), onClick: () => this.addToPlaylistFlow([trackId]) },
    ];
    if (playlists.length) {
      items.push(
        ...playlists.slice(0, 5).map((p) => ({
          label: escapeHtml(p.name),
          icon: icon('playlist'),
          onClick: async () => {
            await api.playlists.addTrack(p.id, trackId);
            await this.refreshPlaylists();
            toast(`Added to “${p.name}”.`, { type: 'success' });
          },
        })),
      );
    }
    items.push('-', { label: 'Go to album', icon: icon('album'), onClick: () => this.router?.navigate(`/albums/${track.albumId}`) });
    items.push({ label: 'Go to artist', icon: icon('artist'), onClick: () => this.router?.navigate(`/artists/${track.artistId}`) });

    const rect = element?.getBoundingClientRect?.();
    if (rect && rect.width) openContextMenu(rect.right - 200, rect.bottom + 6, items);
    else openContextMenu(window.innerWidth / 2 - 100, 120, items);
  },

  /* ---------------------------------- theme -------------------------------- */

  setTheme(theme) {
    store.update('theme', theme);
    persisted.write(THEME_KEY, theme);
    applyTheme(theme);
  },

  toggleTheme() {
    this.setTheme(store.get().theme === 'dark' ? 'light' : 'dark');
  },

  /* ---------------------------- global dispatch ---------------------------- */

  registerViewActions(actions) {
    for (const key of Object.keys(viewActions)) delete viewActions[key];
    Object.assign(viewActions, actions || {});
  },

  handleAction(event) {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    if (action === 'stop') return;

    const custom = viewActions[action];
    if (custom) {
      const result = custom(trigger, event);
      if (result !== false) {
        if (trigger.tagName === 'A') event.preventDefault();
        return;
      }
    }

    const trackId = trigger.dataset.trackId;
    switch (action) {
      case 'play-index':
        event.preventDefault();
        this.playIndex(Number(trigger.dataset.index));
        break;
      case 'play-track':
        event.preventDefault();
        this.playTrack(this.getTrack(trackId));
        break;
      case 'toggle-fav':
        event.preventDefault();
        event.stopPropagation();
        this.toggleFavorite(trackId);
        break;
      case 'track-menu':
        event.preventDefault();
        event.stopPropagation();
        this.openTrackMenu(trackId, trigger);
        break;
      case 'add-to-queue':
        this.addToQueue(this.getTrack(trackId));
        break;
      case 'play-next':
        this.addToQueue(this.getTrack(trackId), { next: true });
        break;
      case 'add-to-playlist':
        this.addToPlaylistFlow(trigger.dataset.trackIds ? trigger.dataset.trackIds.split(',') : [trackId]);
        break;
      case 'new-playlist':
        this.newPlaylistFlow();
        break;
      case 'play-collection':
        this.playCollection(trigger.dataset.collection, trigger.dataset.id);
        break;
      case 'shuffle-collection':
        this.playCollection(trigger.dataset.collection, trigger.dataset.id, { shuffle: true });
        break;
      case 'open-queue':
        store.update('queueOpen', true);
        break;
      case 'close-queue':
        store.update('queueOpen', false);
        break;
      case 'open-fullscreen':
        this.openFullscreenPlayer();
        break;
      case 'toggle-theme':
        this.toggleTheme();
        break;
      case 'logout':
        this.logout();
        break;
      case 'scan-library':
        this.scanLibrary();
        break;
      default:
        break;
    }
  },

  async newPlaylistFlow() {
    const name = await promptDialog({ title: 'New playlist', label: 'Name', placeholder: 'My playlist' });
    if (!name) return;
    const playlist = await this.createPlaylist({ name });
    this.router?.navigate(`/playlists/${playlist.id}`);
  },

  async logout() {
    const okToLeave = await confirmDialog({ title: 'Log out?', message: 'You will need to sign in again to access your library.', confirmLabel: 'Log out' });
    if (!okToLeave) return;
    await api.auth.logout();
    store.update('user', null);
    player.pause();
    this.router?.navigate('/login');
  },

  /** Applies server-side playback preferences to the player. */
  applySettings(settings) {
    if (settings.autoplay != null) player.setAutoAdvance(settings.autoplay !== false);
  },

  /**
   * Surfaces playback problems instead of failing silently — a blocked
   * autoplay or an unreadable file used to stop the queue with no feedback.
   */
  bindPlayerFeedback() {
    player.on('error', ({ message, track, willSkip }) => {
      const suffix = willSkip && track ? ` Skipping “${track.title}”.` : '';
      toast(`${message}${suffix}`, { type: 'error', duration: 5200 });
    });
    player.on('queueend', ({ reason }) => {
      if (reason === 'end') toast('End of queue.', { type: 'info', duration: 2400 });
    });
  },

  async scanLibrary({ force = false } = {}) {
    const { scanLibraryFlow } = await import('./components/scan.js');
    return scanLibraryFlow({ force });
  },

  /* ----------------------------- fullscreen player ------------------------- */

  openFullscreenPlayer() {
    import('./components/fullscreenPlayer.js').then(({ openFullscreenPlayer }) => openFullscreenPlayer());
  },
};

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f6fa' : '#0a0a0f');
}
