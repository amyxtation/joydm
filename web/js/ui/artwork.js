import { escapeHtml, gradientFor, initialsFor } from '../core/utils.js';
import { icon } from '../core/icons.js';

/**
 * Renders a square artwork tile. Uses a real image when `src` is present,
 * otherwise a deterministic gradient + initials fallback (PRD §36).
 */
export function artworkMarkup({
  seed = 'joydm',
  label = '',
  src = null,
  round = false,
  className = '',
  sizes = '',
  lazy = true,
} = {}) {
  const classes = ['artwork', round ? 'artwork--round' : '', className].filter(Boolean).join(' ');
  if (src) {
    return `<span class="${classes}"><img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" ${
      lazy ? 'loading="lazy" decoding="async"' : ''
    } ${sizes ? `sizes="${sizes}"` : ''} /></span>`;
  }
  return `<span class="${classes}" role="img" aria-label="${escapeHtml(label || 'Artwork')}"><span class="artwork__fallback" style="background:${gradientFor(
    seed,
  )}">${escapeHtml(initialsFor(label || seed))}</span></span>`;
}

/** Play button overlay used on cards. */
export function cardPlayButton() {
  return `<span class="card__play" aria-hidden="true">${icon('play', { fill: true })}</span>`;
}
