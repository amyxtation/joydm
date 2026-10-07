import { app } from '../app.js';
import { api } from '../core/api.js';
import { player } from '../core/player.js';
import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';
import { trackListHeader, trackRow } from '../ui/trackRow.js';
import { emptyState, skeletonRows, emptyLibraryState } from './shared.js';

const PAGE_SIZE = 50;

export async function renderSongs(root, ctx) {
  const isAdmin = app.store.get().user?.role === 'admin';
  const view = {
    page: 1,
    sort: ctx.query.sort || 'addedAt',
    order: ctx.query.order || 'desc',
    genreId: ctx.query.genre || '',
  };

  const genres = await api.library.genres().catch(() => []);
  let loading = false;
  let total = 0;
  let collected = [];

  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-head__title">Songs</h1>
          <p class="page-head__sub" data-slot="sub">Loading…</p>
        </div>
        <div class="row wrap">
          <button class="btn" type="button" data-action="play-collection" data-collection="songs">${icon('play', { fill: true })} Play all</button>
          <button class="btn" type="button" data-action="shuffle-collection" data-collection="songs">${icon('shuffle')} Shuffle</button>
        </div>
      </div>
      <div class="chip-row" data-slot="chips"></div>
      <div class="media-list" data-slot="list"></div>
      <div data-slot="sentinel" style="height:1px"></div>
    </div>`;

  const chips = root.querySelector('[data-slot="chips"]');
  const list = root.querySelector('[data-slot="list"]');
  const sub = root.querySelector('[data-slot="sub"]');
  const sentinel = root.querySelector('[data-slot="sentinel"]');

  const renderChips = () => {
    const all = [{ id: '', name: 'All genres' }, ...genres];
    chips.innerHTML = all
      .map(
        (g) =>
          `<button class="chip ${view.genreId === g.id ? 'is-active' : ''}" type="button" data-action="filter-genre" data-genre="${g.id}">${escapeHtml(
            g.name,
          )}${g.trackCount != null ? ` <span class="dim">${g.trackCount}</span>` : ''}</button>`,
      )
      .join('');
  };

  const renderHead = () => {
    if (!list.querySelector('.media-list__head')) {
      list.insertAdjacentHTML('afterbegin', trackListHeader({ sort: view.sort, order: view.order }));
      return;
    }
    list.querySelector('.media-list__head').outerHTML = trackListHeader({ sort: view.sort, order: view.order });
  };

  const rowMarkup = (track, index) =>
    trackRow(track, {
      index,
      current: player.state.currentTrack?.id === track.id,
      favorite: app.isFavorite(track.id),
    });

  async function load({ reset = false } = {}) {
    if (loading) return;
    loading = true;
    if (reset) {
      view.page = 1;
      collected = [];
      list.innerHTML = skeletonRows(10);
    }
    try {
      const res = await api.library.tracks({
        page: view.page,
        limit: PAGE_SIZE,
        sort: view.sort,
        order: view.order,
        genreId: view.genreId || undefined,
      });
      if (ctx.signal?.aborted) return;

      total = res.pagination.total;
      const baseIndex = collected.length;
      collected = collected.concat(res.items);
      app.setPlayContext(collected);

      if (reset || !list.querySelector('.media-row')) {
        list.innerHTML = '';
        renderHead();
      }
      const batch = res.items.map((track, i) => rowMarkup(track, baseIndex + i)).join('');
      if (!batch && collected.length === 0) {
        list.innerHTML =
          total === 0 && !view.genreId
            ? emptyLibraryState({ isAdmin })
            : emptyState({ iconName: 'search', title: 'No songs found', text: 'Try a different filter.' });
      } else {
        list.insertAdjacentHTML('beforeend', batch);
      }

      sub.textContent = `${total} song${total === 1 ? '' : 's'}${view.genreId ? ` in ${genres.find((g) => g.id === view.genreId)?.name || 'genre'}` : ''}`;
      view.page += 1;
      sentinel.hidden = view.page - 1 >= res.pagination.total_pages;
    } catch (error) {
      list.innerHTML = emptyState({ iconName: 'alert', title: 'Could not load songs', text: escapeHtml(error.message) });
    } finally {
      loading = false;
    }
  }

  renderChips();
  await load({ reset: true });

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) load();
    },
    { root: document.getElementById('main'), rootMargin: '600px' },
  );
  observer.observe(sentinel);
  ctx.onCleanup(() => observer.disconnect());

  ctx.setActions({
    sort: (trigger) => {
      const key = trigger.dataset.sort;
      if (view.sort === key) view.order = view.order === 'asc' ? 'desc' : 'asc';
      else {
        view.sort = key;
        view.order = key === 'title' || key === 'artist' || key === 'album' ? 'asc' : 'desc';
      }
      const params = new URLSearchParams({ sort: view.sort, order: view.order });
      if (view.genreId) params.set('genre', view.genreId);
      history.replaceState({}, '', `?${params}`);
      load({ reset: true });
    },
    'filter-genre': (trigger) => {
      view.genreId = trigger.dataset.genre || '';
      renderChips();
      load({ reset: true });
    },
  });

  const syncCurrent = (state) => {
    const id = state.currentTrack?.id;
    list.querySelectorAll('.media-row[data-track-id]').forEach((row) => {
      row.classList.toggle('is-current', row.dataset.trackId === id);
    });
  };
  ctx.onCleanup(player.subscribe(syncCurrent));
}

/** Reusable list of tracks (used by album, playlist, favourites, genre, artist). */
export function staticTrackList(tracks, { sort = 'trackNumber', order = 'asc', showHeader = true, hideFavorite = false, indexOffset = 0 } = {}) {
  if (!tracks.length) return '';
  app.setPlayContext(tracks);
  return `
    ${showHeader ? trackListHeader({ sort, order, hideFavorite }) : ''}
    ${tracks
      .map((track, i) =>
        trackRow(track, {
          index: indexOffset + i,
          current: player.state.currentTrack?.id === track.id,
          favorite: app.isFavorite(track.id),
          hideFavorite,
        }),
      )
      .join('')}`;
}
