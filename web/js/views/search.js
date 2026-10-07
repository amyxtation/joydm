import { app } from '../app.js';
import { api } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { cardGrid, emptyState, sectionHead, skeletonRows, trackCardGrid } from './shared.js';

export async function renderSearch(root, ctx) {
  const query = (ctx.query.q || '').trim();

  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-head__title">Search</h1><p class="page-head__sub" data-slot="sub">${
          query ? `Results for “${escapeHtml(query)}”` : 'Find songs, artists, albums and genres.'
        }</p></div>
      </div>
      <div data-slot="results">${query ? skeletonRows(6) : ''}</div>
    </div>`;

  const results = root.querySelector('[data-slot="results"]');
  const sub = root.querySelector('[data-slot="sub"]');

  if (!query) {
    results.innerHTML = emptyState({
      iconName: 'search',
      title: 'Start typing to search',
      text: 'Search across song titles, artists, albums and genres.',
    });
    return;
  }

  const data = await api.library.search(query);
  if (ctx.signal?.aborted) return;

  const total = data.tracks.length + data.artists.length + data.albums.length + data.genres.length;
  sub.textContent = total ? `${total} result${total === 1 ? '' : 's'} for “${query}”` : `No results for “${query}”`;

  if (!total) {
    results.innerHTML = emptyState({
      iconName: 'search',
      title: 'No matches',
      text: 'Try a different spelling or a broader search term.',
    });
    return;
  }

  app.setPlayContext(data.tracks);

  const blocks = [];
  if (data.tracks.length) {
    blocks.push(`<section class="section">${sectionHead({ title: 'Songs' })}${trackCardGrid(data.tracks.slice(0, 12))}</section>`);
  }
  if (data.artists.length) {
    blocks.push(`<section class="section">${sectionHead({ title: 'Artists' })}${cardGrid(data.artists, 'artist')}</section>`);
  }
  if (data.albums.length) {
    blocks.push(`<section class="section">${sectionHead({ title: 'Albums' })}${cardGrid(data.albums, 'album')}</section>`);
  }
  if (data.genres.length) {
    blocks.push(
      `<section class="section">${sectionHead({ title: 'Genres' })}<div class="chip-row">${data.genres
        .map((g) => `<a class="chip" data-link href="/genres/${g.id}">${escapeHtml(g.name)} · ${g.trackCount}</a>`)
        .join('')}</div></section>`,
    );
  }
  results.innerHTML = blocks.join('');
}
