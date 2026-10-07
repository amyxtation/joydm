import { app } from '../app.js';
import { api } from '../core/api.js';
import { cardGrid, emptyLibraryState, skeletonGrid } from './shared.js';

const SORTS = [
  { key: 'name', label: 'Name' },
  { key: 'songs', label: 'Most songs' },
  { key: 'albums', label: 'Most albums' },
];

export async function renderArtists(root, ctx) {
  const isAdmin = app.store.get().user?.role === 'admin';
  let sort = ctx.query.sort || 'name';

  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-head__title">Artists</h1><p class="page-head__sub" data-slot="sub">Loading…</p></div>
      </div>
      <div class="chip-row" data-slot="chips"></div>
      <div data-slot="grid">${skeletonGrid(8)}</div>
    </div>`;

  const chips = root.querySelector('[data-slot="chips"]');
  const grid = root.querySelector('[data-slot="grid"]');
  const sub = root.querySelector('[data-slot="sub"]');

  const artists = await api.library.artists().catch(() => []);
  if (ctx.signal?.aborted) return;

  const renderChips = () => {
    chips.innerHTML = SORTS.map(
      (s) => `<button class="chip ${sort === s.key ? 'is-active' : ''}" type="button" data-action="artist-sort" data-sort="${s.key}">${s.label}</button>`,
    ).join('');
  };

  const render = () => {
    if (!artists.length) {
      grid.innerHTML = emptyLibraryState({ isAdmin });
      sub.textContent = 'No artists';
      return;
    }
    const sorted = artists.slice().sort((a, b) => {
      if (sort === 'songs') return b.trackCount - a.trackCount || a.name.localeCompare(b.name);
      if (sort === 'albums') return b.albumCount - a.albumCount || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    sub.textContent = `${artists.length} artist${artists.length === 1 ? '' : 's'}`;
    grid.innerHTML = cardGrid(sorted, 'artist');
  };

  renderChips();
  render();

  ctx.setActions({
    'artist-sort': (trigger) => {
      sort = trigger.dataset.sort;
      history.replaceState({}, '', `?sort=${sort}`);
      renderChips();
      render();
    },
  });

  const sync = (state) => {
    const id = state.currentTrack?.artistId;
    grid.querySelectorAll('.card').forEach((node) => node.classList.toggle('is-current', node.dataset.id === id));
  };
  ctx.onCleanup(app.player.subscribe(sync));
}
