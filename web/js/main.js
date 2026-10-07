import { app } from './app.js';
import { api } from './core/api.js';
import { player } from './core/player.js';
import { Router } from './core/router.js';
import { mountShell } from './components/shell.js';
import { toast } from './ui/toast.js';
import { emptyState } from './views/shared.js';

import { renderLogin } from './views/login.js';
import { renderHome } from './views/home.js';
import { renderSongs } from './views/songs.js';
import { renderArtists } from './views/artists.js';
import { renderArtist } from './views/artist.js';
import { renderAlbums } from './views/albums.js';
import { renderAlbum } from './views/album.js';
import { renderGenres } from './views/genres.js';
import { renderGenre } from './views/genre.js';
import { renderPlaylists } from './views/playlists.js';
import { renderPlaylist } from './views/playlist.js';
import { renderFavorites } from './views/favorites.js';
import { renderRecent } from './views/recent.js';
import { renderSearch } from './views/search.js';
import { renderSettings } from './views/settings.js';
import { renderAdmin } from './views/admin.js';
import { renderNotFound } from './views/notFound.js';

const ROUTES = [
  { path: '/login', view: renderLogin, title: 'Sign in' },
  { path: '/', view: renderHome, title: 'Home' },
  { path: '/songs', view: renderSongs, title: 'Songs' },
  { path: '/artists', view: renderArtists, title: 'Artists' },
  { path: '/artists/:id', view: renderArtist, title: 'Artist' },
  { path: '/albums', view: renderAlbums, title: 'Albums' },
  { path: '/albums/:id', view: renderAlbum, title: 'Album' },
  { path: '/genres', view: renderGenres, title: 'Genres' },
  { path: '/genres/:id', view: renderGenre, title: 'Genre' },
  { path: '/playlists', view: renderPlaylists, title: 'Playlists' },
  { path: '/playlists/:id', view: renderPlaylist, title: 'Playlist' },
  { path: '/favorites', view: renderFavorites, title: 'Favorites' },
  { path: '/recent', view: renderRecent, title: 'Recently Played' },
  { path: '/search', view: renderSearch, title: 'Search' },
  { path: '/settings', view: renderSettings, title: 'Settings' },
  { path: '/admin', view: renderAdmin, title: 'Admin' },
];

const main = document.getElementById('main');
let cleanups = [];

function runCleanups() {
  for (const fn of cleanups) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  cleanups = [];
}

async function handleNavigation(entry) {
  runCleanups();
  app.registerViewActions({});
  app.store.update('routePath', entry.path);

  const user = app.store.get().user;
  const isLogin = entry.route?.path === '/login';

  if (!user && !isLogin) {
    app.router.navigate('/login', { replace: true });
    return;
  }
  if (user && isLogin) {
    app.router.navigate('/', { replace: true });
    return;
  }
  if (isLogin) document.body.classList.add('auth-mode');
  else document.body.classList.remove('auth-mode');

  const controller = new AbortController();
  cleanups.push(() => controller.abort());
  main.scrollTop = 0;

  const ctx = {
    params: entry.params,
    query: entry.query,
    signal: controller.signal,
    onCleanup: (fn) => {
      if (typeof fn === 'function') cleanups.push(fn);
    },
    setActions: (map) => app.registerViewActions(map),
  };

  try {
    await entry.route.view(main, ctx);
    document.title = `${entry.route.title || 'JoyDM'} · JoyDM`;
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error('[JoyDM] view failed', error);
    main.innerHTML = `<div class="page">${emptyState({
      iconName: 'alert',
      title: 'Something went wrong',
      text: error.message || 'This page failed to load.',
      action: `<a class="btn" data-link href="/">Back home</a>`,
    })}</div>`;
  }
}

function bindKeyboard() {
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if (typing) {
      if (event.key === 'Escape') target.blur();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.querySelector('.sheet')) return;

    switch (event.key) {
      case ' ':
      case 'Spacebar':
        if (!player.state.currentTrack) return;
        event.preventDefault();
        player.toggle();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (event.shiftKey) player.previous();
        else player.seek(player.state.currentTime - 5);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (event.shiftKey) player.next();
        else player.seek(player.state.currentTime + 5);
        break;
      case 'ArrowUp':
        event.preventDefault();
        player.setVolume(player.state.volume + 0.05);
        break;
      case 'ArrowDown':
        event.preventDefault();
        player.setVolume(player.state.volume - 0.05);
        break;
      case 'm':
      case 'M':
        player.toggleMute();
        break;
      case 'f':
      case 'F': {
        const track = player.state.currentTrack;
        if (track) app.toggleFavorite(track.id);
        break;
      }
      case '/':
        event.preventDefault();
        document.getElementById('search-input')?.focus();
        break;
      default:
        break;
    }
  });
}

function bindHistoryRecording() {
  player.on('trackchange', (track) => {
    if (track) api.history.record({ trackId: track.id, position: 0 }).catch(() => {});
  });

  setInterval(() => {
    const { currentTrack, currentTime, isPlaying } = player.state;
    if (isPlaying && currentTrack) {
      api.history.record({ trackId: currentTrack.id, position: Math.round(currentTime) }).catch(() => {});
    }
  }, 15000);

  window.addEventListener('beforeunload', () => {
    const { currentTrack, currentTime } = player.state;
    if (currentTrack) {
      // Best-effort flush; sendBeacon would be used against the real API.
      try {
        navigator.sendBeacon?.(
          '/api/history',
          new Blob([JSON.stringify({ track_id: currentTrack.id, position: Math.round(currentTime) })], { type: 'application/json' }),
        );
      } catch {
        /* ignore */
      }
    }
  });
}

async function bootstrap() {
  window.addEventListener('error', (event) => {
    if (event.error) console.error('[JoyDM]', event.error);
  });

  mountShell();
  bindKeyboard();
  bindHistoryRecording();

  document.addEventListener('click', (event) => app.handleAction(event));
  document.addEventListener('contextmenu', (event) => {
    const row = event.target.closest('.media-row[data-track-id]');
    if (row) app.openTrackMenu(row.dataset.trackId, event);
  });

  await app.init();
  const user = app.store.get().user;
  if (user) {
    await app.loadShared();
  }

  app.router = new Router(ROUTES, { onChange: handleNavigation, notFound: { path: '/404', view: renderNotFound, title: 'Not found' } });
  app.router.start();

  document.addEventListener('joydm:library-updated', () => {
    app.loadShared().catch(() => {});
    const current = app.router.current;
    if (current) handleNavigation(current);
  });

  if (app.store.get().user) {
    setTimeout(() => {
      const { stats } = app.store.get();
      if (stats && stats.tracks === 0) {
        toast('Your library is empty — add music and run a scan.', { type: 'info', duration: 5200 });
      }
    }, 800);
  }
}

bootstrap().catch((error) => {
  console.error('[JoyDM] bootstrap failed', error);
  document.getElementById('main').innerHTML = `<div class="page">${emptyState({
    iconName: 'alert',
    title: 'JoyDM failed to start',
    text: error.message || 'Unexpected error.',
  })}</div>`;
});
