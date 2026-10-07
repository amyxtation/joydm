import { escapeHtml, formatTime, relativeDate } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { artworkMarkup } from './artwork.js';

/**
 * Renders a single row for the shared media list (PRD §16). Columns are
 * hidden responsively via CSS classes; the same markup powers the songs,
 * album, playlist and favourites lists.
 */
export function trackRow(track, { index = 0, current = false, favorite = false, hideIndex = false, hideFavorite = false, extraActions = '' } = {}) {
  return `
    <div class="media-row ${current ? 'is-current' : ''}" data-track-id="${track.id}" data-index="${index}" tabindex="-1">
      <div class="media-row__index">
        ${hideIndex ? '' : `<span class="num">${index + 1}</span>`}
        <button class="icon-btn icon-btn--sm" type="button" data-action="play-index" data-index="${index}" aria-label="Play ${escapeHtml(
          track.title,
        )}">${icon('play', { fill: true })}</button>
      </div>
      <div class="media-row__track">
        ${artworkMarkup({ seed: track.artworkSeed || track.albumId, label: track.album, className: 'artwork--xs' })}
        <div class="media-row__meta">
          <div class="media-row__title truncate">${escapeHtml(track.title)}</div>
          <div class="media-row__artist truncate">
            <a data-link href="/artists/${track.artistId}" class="media-row__artist-link">${escapeHtml(track.artist)}</a>
          </div>
        </div>
      </div>
      <div class="media-row__album truncate"><a data-link href="/albums/${track.albumId}">${escapeHtml(track.album)}</a></div>
      <div class="media-row__time">${track.available === false ? '<span class="dim">—</span>' : formatTime(track.duration)}</div>
      <div class="media-row__added">${relativeDate(track.addedAt)}</div>
      <div class="media-row__actions">
        ${
          hideFavorite
            ? ''
            : `<button class="icon-btn icon-btn--sm media-row__fav ${favorite ? 'is-fav' : ''}" type="button" data-action="toggle-fav" data-track-id="${
                track.id
              }" aria-label="${favorite ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${favorite}">${icon('heart', {
                fill: favorite,
              })}</button>`
        }
        ${extraActions}
        <button class="icon-btn icon-btn--sm" type="button" data-action="track-menu" data-track-id="${track.id}" aria-label="More options">${icon('more')}</button>
      </div>
    </div>`;
}

/** Header row for the media list with sortable columns. */
export function trackListHeader({ sort = 'addedAt', order = 'desc', hideFavorite = false } = {}) {
  const caret = (key) => (sort === key ? `<span class="sort-caret">${order === 'asc' ? '▲' : '▼'}</span>` : '');
  return `
    <div class="media-list__head" aria-hidden="true">
      <div>#</div>
      <div><button type="button" data-action="sort" data-sort="title">Title ${caret('title')}</button></div>
      <div class="col-album"><button type="button" data-action="sort" data-sort="album">Album ${caret('album')}</button></div>
      <div><button type="button" data-action="sort" data-sort="duration">Time ${caret('duration')}</button></div>
      <div class="col-added"><button type="button" data-action="sort" data-sort="addedAt">Added ${caret('addedAt')}</button></div>
      <div class="col-actions"></div>
    </div>`;
}
