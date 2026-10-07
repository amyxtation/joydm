import { app } from '../app.js';
import { api } from '../core/api.js';
import { cardGrid, emptyLibraryState, skeletonGrid } from './shared.js';

const SORTS = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'year', label: 'Year' },
  { key: 'added', label: 'Recently added' },
];

export async function renderAlbums(root, ctx) {
  const isAdmin = app.store.get().user?.role === 'admin';
  let sort = ctx.query.sort || 'title';

  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-head__title">Albums</h1><p class="page-head__sub" data-slot="sub">Loading…</p></div>
      </div>
      <div class="chip-row" data-slot="chips"></div>
      <div data-slot="grid">${skeletonGrid(8)}</div>
    </div>`;

  const chips = root.querySelector('[data-slot="chips"]');
  const grid = root.querySelector('[data-slot="grid"]');
  const sub = root.querySelector('[data-slot="sub"]');

  const albums = await api.library.albums().catch(() => []);
  if (ctx.signal?.aborted) return;

  const renderChips = () => {
    chips.innerHTML = SORTS.map(
      (s) => `<button class="chip ${sort === s.key ? 'is-active' : ''}" type="button" data-action="album-sort" data-sort="${s.key}">${s.label}</button>`,
    ).join('');
  };

  const render = () => {
    if (!albums.length) {
      grid.innerHTML = emptyLibraryState({ isAdmin });
      sub.textContent = 'No albums';
      return;
    }
    const sorted = albums.slice().sort((a, b) => {
      if (sort === 'artist') return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
      if (sort === 'year') return (b.year || 0) - (a.year || 0);
      if (sort === 'added') return b.trackCount - a.trackCount || a.title.localeCompare(b.title);
      return a.title.localeCompare(b.title);
    });
    sub.textContent = `${albums.length} album${albums.length === 1 ? '' : 's'}`;
    grid.innerHTML = cardGrid(sorted, 'album');
  };

  renderChips();
  render();

  ctx.setActions({
    'album-sort': (trigger) => {
      sort = trigger.dataset.sort;
      history.replaceState({}, '', `?sort=${sort}`);
      renderChips();
      render();
    },
  });
}
