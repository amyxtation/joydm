import { app } from '../app.js';
import { api } from '../core/api.js';
import { player } from '../core/player.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatLongDuration, gradientFor, relativeDate } from '../core/utils.js';
import { artworkMarkup } from '../ui/artwork.js';
import { openContextMenu } from '../ui/contextMenu.js';
import { trackRow, trackListHeader } from '../ui/trackRow.js';
import { toast } from '../ui/toast.js';
import { promptDialog, confirmDialog } from '../ui/sheet.js';
import { emptyState, bindListHighlight } from './shared.js';

export async function renderPlaylist(root, ctx) {
  const playlist = await api.playlists.get(ctx.params.id);
  if (ctx.signal?.aborted) return;

  if (!playlist) {
    root.innerHTML = `<div class="page">${emptyState({
      iconName: 'playlist',
      title: 'Playlist not found',
      text: 'This playlist may have been deleted.',
      action: `<a class="btn" data-link href="/playlists">Back to playlists</a>`,
    })}</div>`;
    return;
  }

  let tracks = playlist.tracks.slice();
  app.setPlayContext(tracks);

  const rows = () =>
    tracks
      .map((track, i) =>
        trackRow(track, {
          index: i,
          current: player.state.currentTrack?.id === track.id,
          favorite: app.isFavorite(track.id),
          extraActions: `<button class="icon-btn icon-btn--sm" type="button" data-action="remove-from-playlist" data-playlist-id="${
            playlist.id
          }" data-track-id="${track.id}" aria-label="Remove from playlist">${icon('minus')}</button>`,
        }),
      )
      .join('');

  const listMarkup = tracks.length
    ? `${trackListHeader({ sort: 'trackNumber', order: 'asc' })}${rows()}`
    : emptyState({
        iconName: 'playlist',
        title: 'This playlist is empty',
        text: 'Find songs and use “Add to playlist” to build it up.',
        action: `<a class="btn btn--primary" data-link href="/songs">Browse songs</a>`,
      });

  root.innerHTML = `
    <div class="page">
      <header class="hero hero__bg" style="--hero-tint:${gradientFor(playlist.artworkSeed || playlist.id)}">
        <div class="hero__art">${artworkMarkup({
          seed: playlist.artworkSeed || playlist.id,
          label: playlist.name,
          src: tracks[0]?.artwork || null,
          lazy: false,
        })}</div>
        <div>
          <div class="hero__eyebrow">Playlist</div>
          <h1 class="hero__title">${escapeHtml(playlist.name)}</h1>
          ${playlist.description ? `<p class="muted" style="max-width:60ch">${escapeHtml(playlist.description)}</p>` : ''}
          <div class="hero__meta" style="margin-top:10px">
            <span>${tracks.length} track${tracks.length === 1 ? '' : 's'}</span>
            <span class="dot">•</span><span>${formatLongDuration(playlist.duration)}</span>
            <span class="dot">•</span><span>Updated ${relativeDate(playlist.updatedAt)}</span>
          </div>
          <div class="hero__actions">
            <button class="btn btn--primary btn--play" type="button" data-action="play-collection" data-collection="playlist" data-id="${
              playlist.id
            }">${icon('play', { fill: true })} Play</button>
            <button class="btn" type="button" data-action="shuffle-collection" data-collection="playlist" data-id="${
              playlist.id
            }">${icon('shuffle')} Shuffle</button>
            <button class="btn" type="button" data-action="playlist-menu">${icon('more')} More</button>
          </div>
        </div>
      </header>
      <div class="media-list" data-slot="tracks">${listMarkup}</div>
    </div>`;

  const list = root.querySelector('[data-slot="tracks"]');
  bindListHighlight(list, ctx.onCleanup);

  const reload = async () => {
    const fresh = await api.playlists.get(playlist.id);
    tracks = fresh ? fresh.tracks : [];
  };

  ctx.setActions({
    'remove-from-playlist': async (trigger) => {
      await api.playlists.removeTrack(playlist.id, trigger.dataset.trackId);
      await reload();
      app.refreshPlaylists();
      const row = list.querySelector(`.media-row[data-track-id="${trigger.dataset.trackId}"]`);
      row?.remove();
      if (!tracks.length) {
        list.innerHTML = emptyState({
          iconName: 'playlist',
          title: 'This playlist is empty',
          text: 'Find songs and use “Add to playlist” to build it up.',
          action: `<a class="btn btn--primary" data-link href="/songs">Browse songs</a>`,
        });
      }
      toast('Removed from playlist.');
    },
    'playlist-menu': (trigger) => {
      const rect = trigger.getBoundingClientRect();
      openContextMenu(rect.right - 220, rect.bottom + 8, [
        { label: 'Play', icon: icon('play'), onClick: () => app.playCollection('playlist', playlist.id) },
        { label: 'Shuffle play', icon: icon('shuffle'), onClick: () => app.playCollection('playlist', playlist.id, { shuffle: true }) },
        { label: 'Add to queue', icon: icon('list'), onClick: () => app.addManyToQueue(tracks) },
        '-',
        { label: 'Rename playlist', icon: icon('settings'), onClick: () => renamePlaylist(playlist, root, ctx) },
        '-',
        { label: 'Delete playlist', icon: icon('trash'), danger: true, onClick: () => deletePlaylist(playlist) },
      ]);
    },
  });

  // Drag-to-reorder rows.
  let dragIndex = null;
  list.addEventListener('dragstart', (event) => {
    const row = event.target.closest('.media-row');
    if (!row) return;
    dragIndex = Number(row.dataset.index);
    row.style.opacity = '0.5';
    event.dataTransfer.effectAllowed = 'move';
  });
  list.addEventListener('dragover', (event) => {
    if (event.target.closest('.media-row')) event.preventDefault();
  });
  list.addEventListener('drop', async (event) => {
    const row = event.target.closest('.media-row');
    event.preventDefault();
    list.querySelectorAll('.media-row').forEach((n) => (n.style.opacity = ''));
    if (!row || dragIndex == null) return;
    const to = Number(row.dataset.index);
    if (to === dragIndex) return;
    const next = tracks.slice();
    const [moved] = next.splice(dragIndex, 1);
    next.splice(to, 0, moved);
    tracks = next;
    dragIndex = null;
    list.innerHTML = `${trackListHeader({ sort: 'trackNumber', order: 'asc' })}${rows()}`;
    app.setPlayContext(tracks);
    await api.playlists.reorder(playlist.id, tracks.map((t) => t.id));
    app.refreshPlaylists();
  });
  list.addEventListener('dragend', () => list.querySelectorAll('.media-row').forEach((n) => (n.style.opacity = '')));

  list.querySelectorAll('.media-row').forEach((row) => row.setAttribute('draggable', 'true'));
  // Newly inserted rows after re-render also need draggable.
  const observer = new MutationObserver(() => list.querySelectorAll('.media-row:not([draggable])').forEach((r) => r.setAttribute('draggable', 'true')));
  observer.observe(list, { childList: true, subtree: true });
  ctx.onCleanup(() => observer.disconnect());
}

async function renamePlaylist(playlist, root, ctx) {
  const name = await promptDialog({ title: 'Rename playlist', label: 'Name', value: playlist.name });
  if (!name) return;
  await api.playlists.update(playlist.id, { name });
  await app.refreshPlaylists();
  root.querySelector('.hero__title').textContent = name;
  toast('Playlist renamed.', { type: 'success' });
  void ctx;
}

async function deletePlaylist(playlist) {
  const confirmed = await confirmDialog({
    title: 'Delete playlist?',
    message: `“${playlist.name}” will be permanently deleted. This does not remove any music files.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  await api.playlists.remove(playlist.id);
  await app.refreshPlaylists();
  toast('Playlist deleted.');
  app.router.navigate('/playlists');
}
