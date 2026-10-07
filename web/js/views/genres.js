import { app } from '../app.js';
import { api } from '../core/api.js';
import { escapeHtml, gradientFor } from '../core/utils.js';
import { emptyLibraryState, skeletonGrid } from './shared.js';

export async function renderGenres(root, ctx) {
  const isAdmin = app.store.get().user?.role === 'admin';
  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-head__title">Genres</h1><p class="page-head__sub" data-slot="sub">Loading…</p></div>
      </div>
      <div data-slot="grid">${skeletonGrid(6, 'sk-card')}</div>
    </div>`;

  const grid = root.querySelector('[data-slot="grid"]');
  const sub = root.querySelector('[data-slot="sub"]');

  const genres = await api.library.genres().catch(() => []);
  if (ctx.signal?.aborted) return;

  if (!genres.length) {
    grid.innerHTML = emptyLibraryState({ isAdmin });
    sub.textContent = 'No genres';
    return;
  }

  sub.textContent = `${genres.length} genres`;
  grid.innerHTML = `<div class="grid grid--wide">${genres
    .map(
      (g) => `
      <a class="genre-card" data-link href="/genres/${g.id}" style="--genre-grad:${gradientFor(g.name)}">
        <span>
          <span class="genre-card__name" style="display:block">${escapeHtml(g.name)}</span>
          <span class="genre-card__count">${g.trackCount} tracks · ${g.albumCount} albums</span>
        </span>
      </a>`,
    )
    .join('')}</div>`;
}
