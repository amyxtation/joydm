import { app } from '../app.js';
import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';
import { artworkMarkup } from '../ui/artwork.js';
import { emptyState } from './shared.js';

function playlistCard(playlist) {
  return `
    <a class="card" data-link href="/playlists/${playlist.id}">
      <div class="card__art">
        ${artworkMarkup({ seed: playlist.artworkSeed || playlist.id, label: playlist.name })}
        <button class="card__play" type="button" data-action="play-collection" data-collection="playlist" data-id="${
          playlist.id
        }" aria-label="Play ${escapeHtml(playlist.name)}">${icon('play', { fill: true })}</button>
      </div>
      <div class="card__title truncate">${escapeHtml(playlist.name)}</div>
      <div class="card__sub truncate">${playlist.trackCount} track${playlist.trackCount === 1 ? '' : 's'}</div>
    </a>`;
}

export async function renderPlaylists(root, ctx) {
  const playlists = app.store.get().playlists;

  const newTile = `
    <button class="card" type="button" data-action="new-playlist">
      <div class="card__art" style="display:grid;place-items:center;aspect-ratio:1;border-radius:var(--radius-md);background:var(--surface-2);border:1px dashed var(--border-strong)">
        <span class="state__icon" style="margin:0;width:52px;height:52px;color:var(--accent)">${icon('plus')}</span>
      </div>
      <div class="card__title truncate">New playlist</div>
      <div class="card__sub truncate">Start from scratch</div>
    </button>`;

  root.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-head__title">Playlists</h1>
          <p class="page-head__sub">${
            playlists.length ? `${playlists.length} playlist${playlists.length === 1 ? '' : 's'}` : 'Create playlists to organise your music'
          }</p>
        </div>
        <button class="btn btn--primary" type="button" data-action="new-playlist">${icon('plus')} New playlist</button>
      </div>
      <div class="grid grid--cards">${newTile}${playlists.map(playlistCard).join('')}</div>
      ${
        playlists.length
          ? ''
          : `<div style="margin-top:24px">${emptyState({
              iconName: 'playlist',
              title: 'No playlists yet',
              text: 'Playlists let you group tracks from anywhere in your library.',
            })}</div>`
      }
    </div>`;
  void ctx;
}
