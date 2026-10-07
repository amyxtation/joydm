import { app } from '../app.js';
import { player } from '../core/player.js';
import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';
import { artworkMarkup } from '../ui/artwork.js';

/** Standard empty / informational state block. */
export function emptyState({ iconName = 'music', title, text, action = '' }) {
  return `
    <div class="state">
      <div class="state__icon">${icon(iconName)}</div>
      <div class="state__title">${escapeHtml(title)}</div>
      <p class="state__text">${text}</p>
      ${action}
    </div>`;
}

export function skeletonGrid(count = 8, className = 'sk-card') {
  return `<div class="grid grid--cards">${Array.from({ length: count }, () => `<div class="skeleton ${className}"></div>`).join('')}</div>`;
}

export function skeletonRows(count = 10) {
  return `<div class="media-list">${Array.from({ length: count }, () => '<div class="skeleton sk-row" style="margin-bottom:6px"></div>').join('')}</div>`;
}

export function sectionHead({ title, subtitle = '', link = null, linkLabel = 'See all' }) {
  return `
    <div class="section__head">
      <div>
        <h2 class="section__title">${escapeHtml(title)}</h2>
        ${subtitle ? `<div class="section__subtitle">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      ${link ? `<a class="section__link" data-link href="${link}">${escapeHtml(linkLabel)} ${icon('chevronRight')}</a>` : ''}
    </div>`;
}

/** Library is empty — show the guided empty state from PRD §76. */
export function emptyLibraryState({ isAdmin }) {
  return emptyState({
    iconName: 'music',
    title: 'Your music library is empty',
    text: `Add your music files to <code>${escapeHtml(app.store.get().libraryRoot)}</code>, then run a scan to build your library.`,
    action: isAdmin
      ? `<button class="btn btn--primary" type="button" data-action="scan-library">${icon('scan')} Scan Library</button>`
      : '',
  });
}

/** Highlights the row of the currently playing track inside `container`. */
export function bindListHighlight(container, onCleanup) {
  const sync = (state) => {
    const id = state.currentTrack?.id;
    container.querySelectorAll('.media-row[data-track-id]').forEach((row) => {
      row.classList.toggle('is-current', row.dataset.trackId === id);
    });
  };
  sync(player.state);
  onCleanup?.(player.subscribe(sync));
}

/** Renders a grid of album/artist/playlist cards. */
export function cardGrid(items, kind) {
  if (!items.length) return '';
  return `<div class="grid grid--cards">${items.map((item) => card(item, kind)).join('')}</div>`;
}

/** Compact card for a single track (used on Home shelves and search). */
export function trackCard(track, shelf = '') {
  const current = player.state.currentTrack?.id === track.id;
  const action = shelf
    ? `data-action="play-shelf" data-shelf="${shelf}"`
    : 'data-action="play-track"';
  return `
    <article class="card ${current ? 'is-current' : ''}" data-track-id="${track.id}">
      <div class="card__art">
        ${artworkMarkup({ seed: track.artworkSeed || track.albumId, label: track.album, src: track.artwork || null })}
        <button class="card__play" type="button" ${action} data-track-id="${track.id}" aria-label="Play ${escapeHtml(
          track.title,
        )}">${icon('play', { fill: true })}</button>
      </div>
      <div class="card__title truncate">${escapeHtml(track.title)}</div>
      <div class="card__sub truncate">${escapeHtml(track.artist)}</div>
    </article>`;
}

export function trackCardGrid(tracks, shelf = '') {
  return `<div class="grid grid--cards">${tracks.map((track) => trackCard(track, shelf)).join('')}</div>`;
}

export function card(item, kind) {
  const label = item.name || item.title;
  const config = {
    album: {
      href: `/albums/${item.id}`,
      sub: `${item.artist}${item.year ? ` · ${item.year}` : ''}${item.trackCount != null ? ` · ${item.trackCount} tracks` : ''}`,
      seed: item.artworkSeed || item.id,
      round: false,
      label,
    },
    artist: { href: `/artists/${item.id}`, sub: `${item.trackCount} songs`, seed: item.id, round: true, label },
    playlist: { href: `/playlists/${item.id}`, sub: `${item.trackCount} tracks`, seed: item.artworkSeed || item.id, round: false, label },
  }[kind];
  const art = artworkMarkup({ seed: config.seed, label: config.label, round: config.round, src: item.artwork || null });
  return `
    <a class="card" data-link href="${config.href}">
      <div class="card__art">
        ${art}
        <button class="card__play" type="button" data-action="play-collection" data-collection="${kind}" data-id="${item.id}" aria-label="Play ${escapeHtml(
          label,
        )}">${icon('play', { fill: true })}</button>
      </div>
      <div class="card__title truncate">${escapeHtml(label)}</div>
      <div class="card__sub truncate">${escapeHtml(config.sub)}</div>
    </a>`;
}
