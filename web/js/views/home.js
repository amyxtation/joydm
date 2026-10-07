import { app } from '../app.js';
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatLongDuration } from '../core/utils.js';
import { sectionHead, emptyState, emptyLibraryState, trackCardGrid, skeletonGrid } from './shared.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function quickTile({ href, action, collection, id, iconName, title, sub, grad }) {
  const tag = action ? 'button' : 'a';
  const attrs = action
    ? `type="button" data-action="${action}" data-collection="${collection}" data-id="${id}"`
    : `data-link href="${href}"`;
  return `
    <${tag} class="quick-tile" ${attrs}>
      <span class="quick-tile__icon" style="--tile-grad:${grad}">${icon(iconName)}</span>
      <span class="grow">
        <span class="quick-tile__title truncate" style="display:block">${escapeHtml(title)}</span>
        <span class="quick-tile__sub truncate" style="display:block">${escapeHtml(sub)}</span>
      </span>
    </${tag}>`;
}

export async function renderHome(root, ctx) {
  const state = app.store.get();
  const isAdmin = state.user?.role === 'admin';
  const stats = state.stats;

  if (stats && stats.tracks === 0) {
    root.innerHTML = `<div class="page">
      <div class="page-head"><div><h1 class="page-head__title">${escapeHtml(greeting())}</h1>
      <p class="page-head__sub">Welcome to JoyDM.</p></div></div>
      ${emptyLibraryState({ isAdmin })}
    </div>`;
    return;
  }

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-head__title">${escapeHtml(greeting())}</h1>
        <p class="page-head__sub">${
          stats
            ? `${stats.tracks} songs · ${stats.albums} albums · ${stats.artists} artists · ${formatLongDuration(stats.duration)}`
            : 'Loading your library…'
        }</p>
      </div>
      <button class="btn btn--primary" type="button" data-action="shuffle-collection" data-collection="songs">${icon('shuffle')} Shuffle all</button>
    </div>

    <section class="section">
      ${sectionHead({ title: 'Quick access' })}
      <div class="quick-grid">
        ${quickTile({ href: '/songs', iconName: 'songs', title: 'All Songs', sub: stats ? `${stats.tracks} tracks` : '', grad: 'linear-gradient(135deg,#7c5cff,#b45cff)' })}
        ${quickTile({ href: '/artists', iconName: 'artist', title: 'Artists', sub: stats ? `${stats.artists} artists` : '', grad: 'linear-gradient(135deg,#ff5c8a,#ff9d5c)' })}
        ${quickTile({ href: '/albums', iconName: 'album', title: 'Albums', sub: stats ? `${stats.albums} albums` : '', grad: 'linear-gradient(135deg,#3ddc97,#3db6dc)' })}
        ${quickTile({ href: '/playlists', iconName: 'playlist', title: 'Playlists', sub: `${state.playlists.length} playlists`, grad: 'linear-gradient(135deg,#ffcb5c,#ff8a5c)' })}
      </div>
    </section>

    <section class="section"><div data-slot="recently-played">${skeletonGrid(4)}</div></section>
    <section class="section"><div data-slot="recently-added">${skeletonGrid(4)}</div></section>
    <section class="section"><div data-slot="favorites">${skeletonGrid(4)}</div></section>
  </div>`;

  const [history, recentAdded, favorites] = await Promise.all([
    api.history.list(12).catch(() => []),
    api.library.tracks({ page: 1, limit: 8, sort: 'addedAt', order: 'desc' }).catch(() => ({ items: [] })),
    api.favorites.list().catch(() => []),
  ]);

  if (ctx.signal?.aborted) return;

  const recentlyPlayed = [];
  const seen = new Set();
  for (const entry of history) {
    if (seen.has(entry.track.id)) continue;
    seen.add(entry.track.id);
    recentlyPlayed.push(entry.track);
  }

  const shelves = {};

  const renderShelf = (slot, tracks, { title, link = null, emptyTitle, emptyText }) => {
    const host = root.querySelector(`[data-slot="${slot}"]`);
    if (!host) return;
    shelves[slot] = tracks;
    if (!tracks.length) {
      host.innerHTML = `${sectionHead({ title })}${emptyState({
        iconName: 'music',
        title: emptyTitle,
        text: emptyText,
      })}`;
      return;
    }
    app.indexTracks(tracks);
    host.innerHTML = `${sectionHead({ title, link, linkLabel: 'See all' })}${trackCardGrid(tracks, slot)}`;
  };

  renderShelf('recently-played', recentlyPlayed.slice(0, 8), {
    title: 'Recently played',
    emptyTitle: 'No listening history yet',
    emptyText: 'Tracks you play will show up here.',
  });
  renderShelf('recently-added', recentAdded.items || [], {
    title: 'Recently added',
    link: '/songs',
    emptyTitle: 'Nothing added yet',
    emptyText: 'Scan your library to import music.',
  });
  renderShelf('favorites', favorites.slice(0, 8), {
    title: 'Favorites',
    link: '/favorites',
    emptyTitle: 'No favorites yet',
    emptyText: 'Tap the heart on any track to save it here.',
  });

  if (ctx.setActions) {
    ctx.setActions({
      'play-shelf': (trigger) => {
        const tracks = shelves[trigger.dataset.shelf] || [];
        if (!tracks.length) return;
        const index = Math.max(0, tracks.findIndex((t) => t.id === trigger.dataset.trackId));
        app.setPlayContext(tracks);
        app.player.playQueue(tracks, index);
      },
    });
  }

  if (ctx.onCleanup) {
    const sync = (playerState) => {
      const id = playerState.currentTrack?.id;
      root.querySelectorAll('.card[data-track-id]').forEach((node) => {
        node.classList.toggle('is-current', node.dataset.trackId === id);
      });
    };
    ctx.onCleanup(app.player.subscribe(sync));
  }
}
