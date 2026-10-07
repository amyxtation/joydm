import { app } from '../app.js';
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { escapeHtml, relativeDate } from '../core/utils.js';
import { emptyState, bindListHighlight, skeletonRows } from './shared.js';

export async function renderRecent(root, ctx) {
  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-head__title">Recently Played</h1><p class="page-head__sub" data-slot="sub">Loading…</p></div>
        <div class="row wrap" data-slot="actions"></div>
      </div>
      <div class="media-list" data-slot="list">${skeletonRows(8)}</div>
    </div>`;

  const list = root.querySelector('[data-slot="list"]');
  const sub = root.querySelector('[data-slot="sub"]');
  const actions = root.querySelector('[data-slot="actions"]');

  const history = await api.history.list(100).catch(() => []);
  if (ctx.signal?.aborted) return;

  const seen = new Set();
  const entries = [];
  for (const entry of history) {
    if (seen.has(entry.track.id)) continue;
    seen.add(entry.track.id);
    entries.push(entry);
  }
  const tracks = entries.map((e) => e.track);
  app.setPlayContext(tracks);

  if (!entries.length) {
    list.innerHTML = emptyState({
      iconName: 'clock',
      title: 'Nothing played yet',
      text: 'Your listening history will appear here.',
      action: `<a class="btn btn--primary" data-link href="/songs">Browse songs</a>`,
    });
    sub.textContent = 'No history';
    return;
  }

  sub.textContent = `${entries.length} recent track${entries.length === 1 ? '' : 's'}`;
  actions.innerHTML = `<button class="btn" type="button" data-action="play-collection" data-collection="recent">${icon(
    'play',
    { fill: true },
  )} Play all</button>`;

  list.innerHTML = entries
    .map(
      (entry, i) => `
    <div class="media-row" data-track-id="${entry.track.id}" data-index="${i}">
      <div class="media-row__index"><span class="num">${i + 1}</span>
        <button class="icon-btn icon-btn--sm" type="button" data-action="play-index" data-index="${i}" aria-label="Play">${icon('play', { fill: true })}</button>
      </div>
      <div class="media-row__track">
        <div class="media-row__meta">
          <div class="media-row__title truncate">${escapeHtml(entry.track.title)}</div>
          <div class="media-row__artist truncate"><a data-link href="/artists/${entry.track.artistId}">${escapeHtml(entry.track.artist)}</a></div>
        </div>
      </div>
      <div class="media-row__album truncate"><a data-link href="/albums/${entry.track.albumId}">${escapeHtml(entry.track.album)}</a></div>
      <div class="media-row__time">${relativeDate(entry.playedAt)}</div>
      <div class="media-row__added"></div>
      <div class="media-row__actions">
        <button class="icon-btn icon-btn--sm" type="button" data-action="track-menu" data-track-id="${entry.track.id}" aria-label="More">${icon('more')}</button>
      </div>
    </div>`,
    )
    .join('');

  bindListHighlight(list, ctx.onCleanup);
}
