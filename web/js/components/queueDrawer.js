import { app } from '../app.js';
import { player } from '../core/player.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatTime } from '../core/utils.js';
import { artworkMarkup } from '../ui/artwork.js';

export function mountQueueDrawer() {
  const drawer = document.getElementById('queue-drawer');
  let lastSignature = '';

  drawer.innerHTML = `
    <div class="panel-head">
      <h2>Queue</h2>
      <div class="row">
        <button class="btn btn--sm btn--ghost" type="button" data-action="clear-queue">${icon('trash')} Clear</button>
        <button class="icon-btn icon-btn--sm" type="button" data-action="close-queue" aria-label="Close queue">${icon('x')}</button>
      </div>
    </div>
    <div class="panel-body" data-slot="body"></div>`;

  const body = drawer.querySelector('[data-slot="body"]');

  const itemMarkup = (track, index, isCurrent) => `
    <div class="queue-item ${isCurrent ? 'is-current' : ''}" draggable="true" data-queue-index="${index}">
      <span class="queue-item__handle" aria-hidden="true">${icon('grid')}</span>
      ${artworkMarkup({ seed: track.artworkSeed || track.albumId, label: track.album, className: 'artwork--xs' })}
      <div class="grow">
        <div class="queue-item__title truncate">${escapeHtml(track.title)}</div>
        <div class="queue-item__artist truncate">${escapeHtml(track.artist)}</div>
      </div>
      <button class="icon-btn icon-btn--sm" type="button" data-remove-index="${index}" aria-label="Remove from queue">${icon('x')}</button>
    </div>`;

  function render(state) {
    const signature = `${state.queue.map((t) => t.id).join(',')}|${state.currentIndex}`;
    if (signature === lastSignature) return;
    lastSignature = signature;

    if (!state.queue.length) {
      body.innerHTML = `
        <div class="state" style="border-style:solid;padding:32px 16px">
          <div class="state__icon">${icon('queue')}</div>
          <div class="state__title">Queue is empty</div>
          <p class="state__text">Play an album or add tracks to build your queue.</p>
        </div>`;
      return;
    }

    const current = state.currentIndex >= 0 ? state.queue[state.currentIndex] : null;
    const upcoming = state.queue.filter((_, i) => i !== state.currentIndex);
    const totalSeconds = state.queue.reduce((sum, t) => sum + (t.duration || 0), 0);

    body.innerHTML = `
      ${current ? `<div class="queue-group-label">Now playing</div>${itemMarkup(current, state.currentIndex, true)}` : ''}
      ${upcoming.length ? `<div class="queue-group-label">Next up · ${upcoming.length} · ${formatTime(totalSeconds)} total</div>` : ''}
      ${state.queue.map((t, i) => (i === state.currentIndex ? '' : itemMarkup(t, i, false))).join('')}`;
  }

  // Play / remove
  body.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('[data-remove-index]');
    if (removeBtn) {
      player.removeFromQueue(Number(removeBtn.dataset.removeIndex));
      return;
    }
    const item = event.target.closest('[data-queue-index]');
    if (item) player.jumpTo(Number(item.dataset.queueIndex));
  });

  // Drag reorder
  let dragIndex = null;
  body.addEventListener('dragstart', (event) => {
    const item = event.target.closest('[data-queue-index]');
    if (!item) return;
    dragIndex = Number(item.dataset.queueIndex);
    item.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
  });
  body.addEventListener('dragover', (event) => {
    const item = event.target.closest('[data-queue-index]');
    if (!item) return;
    event.preventDefault();
    body.querySelectorAll('.is-drop-target').forEach((n) => n.classList.remove('is-drop-target'));
    item.classList.add('is-drop-target');
  });
  body.addEventListener('drop', (event) => {
    const item = event.target.closest('[data-queue-index]');
    if (!item || dragIndex == null) return;
    event.preventDefault();
    const to = Number(item.dataset.queueIndex);
    if (to !== dragIndex) player.moveInQueue(dragIndex, to);
    dragIndex = null;
  });
  body.addEventListener('dragend', () => {
    body.querySelectorAll('.is-dragging, .is-drop-target').forEach((n) => n.classList.remove('is-dragging', 'is-drop-target'));
    dragIndex = null;
  });

  const clearBtn = drawer.querySelector('[data-action="clear-queue"]');
  clearBtn.addEventListener('click', () => player.clearQueue());

  player.subscribe(render, { immediate: true });
  app.store.subscribe((state) => {
    if (state.queueOpen) render(player.state);
  });
}
