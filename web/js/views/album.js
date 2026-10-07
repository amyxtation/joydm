import { app } from '../app.js';
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatLongDuration, gradientFor } from '../core/utils.js';
import { artworkMarkup } from '../ui/artwork.js';
import { openContextMenu } from '../ui/contextMenu.js';
import { staticTrackList } from './songs.js';
import { emptyState, bindListHighlight } from './shared.js';

export async function renderAlbum(root, ctx) {
  const album = await api.library.album(ctx.params.id);
  if (ctx.signal?.aborted) return;

  if (!album) {
    root.innerHTML = `<div class="page">${emptyState({
      iconName: 'album',
      title: 'Album not found',
      text: 'This album is not in your library.',
      action: `<a class="btn" data-link href="/albums">Back to albums</a>`,
    })}</div>`;
    return;
  }

  const tracks = album.tracks || [];
  const trackIds = tracks.map((t) => t.id).join(',');

  root.innerHTML = `
    <div class="page">
      <header class="hero hero__bg" style="--hero-tint:${gradientFor(album.artworkSeed || album.id)}">
        <div class="hero__art">${artworkMarkup({ seed: album.artworkSeed || album.id, label: album.title, src: album.artwork || null, lazy: false })}</div>
        <div>
          <div class="hero__eyebrow">Album</div>
          <h1 class="hero__title">${escapeHtml(album.title)}</h1>
          <div class="hero__meta">
            <a data-link href="/artists/${album.artistId}" style="font-weight:600;color:var(--text)">${escapeHtml(album.artist)}</a>
            <span class="dot">•</span><span>${album.year || '—'}</span>
            <span class="dot">•</span><span>${tracks.length} track${tracks.length === 1 ? '' : 's'}</span>
            <span class="dot">•</span><span>${formatLongDuration(album.duration)}</span>
          </div>
          <div class="hero__actions">
            <button class="btn btn--primary btn--play" type="button" data-action="play-collection" data-collection="album" data-id="${album.id}">${icon(
              'play',
              { fill: true },
            )} Play</button>
            <button class="btn" type="button" data-action="shuffle-collection" data-collection="album" data-id="${album.id}">${icon('shuffle')} Shuffle</button>
            <button class="btn" type="button" data-action="add-to-playlist" data-track-ids="${trackIds}">${icon('plus')} Add to playlist</button>
            <button class="btn" type="button" data-action="album-menu" data-id="${album.id}">${icon('more')}</button>
          </div>
        </div>
      </header>

      <div class="media-list" data-slot="tracks">
        ${staticTrackList(tracks, { sort: 'trackNumber', order: 'asc' })}
      </div>
    </div>`;

  const list = root.querySelector('[data-slot="tracks"]');
  bindListHighlight(list, ctx.onCleanup);

  ctx.setActions({
    'album-menu': (trigger) => {
      const rect = trigger.getBoundingClientRect();
      openContextMenu(rect.right - 220, rect.bottom + 8, [
        { label: 'Play', icon: icon('play'), onClick: () => app.playCollection('album', album.id) },
        { label: 'Shuffle play', icon: icon('shuffle'), onClick: () => app.playCollection('album', album.id, { shuffle: true }) },
        '-',
        { label: 'Add to playlist', icon: icon('plus'), onClick: () => app.addToPlaylistFlow(tracks.map((t) => t.id)) },
        { label: 'Add to queue', icon: icon('list'), onClick: () => app.addManyToQueue(tracks) },
        '-',
        { label: 'Go to artist', icon: icon('artist'), onClick: () => app.router.navigate(`/artists/${album.artistId}`) },
      ]);
    },
  });
}
