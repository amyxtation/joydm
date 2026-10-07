import { app } from '../app.js';
import { api } from '../core/api.js';
import { player } from '../core/player.js';
import { icon } from '../core/icons.js';
import { formatLongDuration } from '../core/utils.js';
import { trackRow, trackListHeader } from '../ui/trackRow.js';
import { emptyState, bindListHighlight, skeletonRows } from './shared.js';

export async function renderFavorites(root, ctx) {
  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-head__title">Favorites</h1><p class="page-head__sub" data-slot="sub">Loading…</p></div>
        <div class="row wrap" data-slot="actions"></div>
      </div>
      <div class="media-list" data-slot="list">${skeletonRows(8)}</div>
    </div>`;

  const list = root.querySelector('[data-slot="list"]');
  const sub = root.querySelector('[data-slot="sub"]');
  const actions = root.querySelector('[data-slot="actions"]');

  const tracks = await api.favorites.list().catch(() => []);
  if (ctx.signal?.aborted) return;

  app.setPlayContext(tracks);

  const render = () => {
    const current = app.store.get();
    const items = tracks.filter((t) => current.favorites.has(t.id));
    if (!items.length) {
      list.innerHTML = emptyState({
        iconName: 'heart',
        title: 'No favorites yet',
        text: 'Tap the heart on any song to keep it here.',
        action: `<a class="btn btn--primary" data-link href="/songs">Browse songs</a>`,
      });
      sub.textContent = 'Nothing saved';
      actions.innerHTML = '';
      return;
    }
    sub.textContent = `${items.length} song${items.length === 1 ? '' : 's'} · ${formatLongDuration(
      items.reduce((sum, t) => sum + t.duration, 0),
    )}`;
    actions.innerHTML = `
      <button class="btn" type="button" data-action="play-collection" data-collection="favorites">${icon('play', { fill: true })} Play all</button>
      <button class="btn" type="button" data-action="shuffle-collection" data-collection="favorites">${icon('shuffle')} Shuffle</button>`;
    list.innerHTML = `${trackListHeader({ sort: 'addedAt', order: 'desc' })}${items
      .map((track, i) =>
        trackRow(track, { index: i, current: player.state.currentTrack?.id === track.id, favorite: true }),
      )
      .join('')}`;
    app.setPlayContext(items);
  };

  render();
  bindListHighlight(list, ctx.onCleanup);

  // Re-render when a favourite is removed so the list stays accurate.
  let lastFav = app.store.get().favoriteIds.join(',');
  ctx.onCleanup(
    app.store.subscribe((state) => {
      const signature = state.favoriteIds.join(',');
      if (signature === lastFav) return;
      lastFav = signature;
      render();
    }),
  );
}
