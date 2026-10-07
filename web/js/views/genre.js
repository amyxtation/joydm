import { app } from '../app.js';
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatLongDuration, gradientFor } from '../core/utils.js';
import { staticTrackList } from './songs.js';
import { emptyState, bindListHighlight } from './shared.js';

export async function renderGenre(root, ctx) {
  const genres = await api.library.genres().catch(() => []);
  const genre = genres.find((g) => g.id === ctx.params.id);
  const res = await api.library.tracks({ genreId: ctx.params.id, limit: 200, sort: 'artist', order: 'asc' });
  if (ctx.signal?.aborted) return;

  if (!genre && !res.items.length) {
    root.innerHTML = `<div class="page">${emptyState({
      iconName: 'genre',
      title: 'Genre not found',
      text: 'There are no tracks in this genre.',
      action: `<a class="btn" data-link href="/genres">Back to genres</a>`,
    })}</div>`;
    return;
  }

  const tracks = res.items;
  const duration = tracks.reduce((sum, t) => sum + t.duration, 0);

  root.innerHTML = `
    <div class="page">
      <header class="hero hero__bg" style="--hero-tint:${gradientFor(genre?.name || ctx.params.id)}">
        <div class="hero__art">${`<span class="artwork artwork--lg"><span class="artwork__fallback" style="background:${gradientFor(
          genre?.name || ctx.params.id,
        )}">${escapeHtml((genre?.name || '?').slice(0, 2).toUpperCase())}</span></span>`}</div>
        <div>
          <div class="hero__eyebrow">Genre</div>
          <h1 class="hero__title">${escapeHtml(genre?.name || 'Genre')}</h1>
          <div class="hero__meta"><span>${tracks.length} track${tracks.length === 1 ? '' : 's'}</span><span class="dot">•</span><span>${formatLongDuration(
            duration,
          )}</span></div>
          <div class="hero__actions">
            <button class="btn btn--primary btn--play" type="button" data-action="play-collection" data-collection="genre" data-id="${ctx.params.id}">${icon(
              'play',
              { fill: true },
            )} Play</button>
            <button class="btn" type="button" data-action="shuffle-collection" data-collection="genre" data-id="${ctx.params.id}">${icon('shuffle')} Shuffle</button>
          </div>
        </div>
      </header>

      <div class="media-list" data-slot="tracks">${staticTrackList(tracks, { sort: 'artist', order: 'asc' })}</div>
    </div>`;

  bindListHighlight(root.querySelector('[data-slot="tracks"]'), ctx.onCleanup);
}
