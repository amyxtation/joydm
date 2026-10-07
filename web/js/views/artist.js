import { app } from '../app.js';
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatLongDuration, gradientFor } from '../core/utils.js';
import { artworkMarkup } from '../ui/artwork.js';
import { staticTrackList } from './songs.js';
import { emptyState, bindListHighlight, sectionHead, cardGrid } from './shared.js';

export async function renderArtist(root, ctx) {
  const artist = await api.library.artist(ctx.params.id);
  if (ctx.signal?.aborted) return;

  if (!artist) {
    root.innerHTML = `<div class="page">${emptyState({
      iconName: 'artist',
      title: 'Artist not found',
      text: 'This artist is not in your library.',
      action: `<a class="btn" data-link href="/artists">Back to artists</a>`,
    })}</div>`;
    return;
  }

  const tracksRes = await api.library.tracks({ artistId: artist.id, limit: 200, sort: 'album', order: 'asc' });
  if (ctx.signal?.aborted) return;
  const tracks = tracksRes.items;

  root.innerHTML = `
    <div class="page">
      <header class="hero hero__bg" style="--hero-tint:${gradientFor(artist.id)}">
        <div class="hero__art hero__art--round">${artworkMarkup({
          seed: artist.id,
          label: artist.name,
          round: true,
          lazy: false,
        })}</div>
        <div>
          <div class="hero__eyebrow">Artist</div>
          <h1 class="hero__title">${escapeHtml(artist.name)}</h1>
          <div class="hero__stats">
            <div class="hero__stat"><b>${artist.albumCount}</b><span>Albums</span></div>
            <div class="hero__stat"><b>${artist.trackCount}</b><span>Songs</span></div>
            <div class="hero__stat"><b>${formatLongDuration(artist.duration)}</b><span>Total</span></div>
          </div>
          <div class="hero__actions">
            <button class="btn btn--primary btn--play" type="button" data-action="play-collection" data-collection="artist" data-id="${artist.id}">${icon(
              'play',
              { fill: true },
            )} Play</button>
            <button class="btn" type="button" data-action="shuffle-collection" data-collection="artist" data-id="${artist.id}">${icon('shuffle')} Shuffle</button>
          </div>
        </div>
      </header>

      <section class="section">
        ${sectionHead({ title: 'Albums' })}
        ${cardGrid(artist.albums, 'album')}
      </section>

      <section class="section">
        ${sectionHead({ title: 'Songs' })}
        <div class="media-list" data-slot="tracks">${staticTrackList(tracks, { sort: 'album', order: 'asc' })}</div>
      </section>
    </div>`;

  const list = root.querySelector('[data-slot="tracks"]');
  if (list) bindListHighlight(list, ctx.onCleanup);
}
