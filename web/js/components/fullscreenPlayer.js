import { app } from '../app.js';
import { player, REPEAT_LABELS } from '../core/player.js';
import { icon } from '../core/icons.js';
import { formatTime, gradientFor } from '../core/utils.js';
import { artworkMarkup } from '../ui/artwork.js';
import { openRepeatMenu } from '../ui/repeatMenu.js';

export function openFullscreenPlayer() {
  if (!player.state.currentTrack) return;
  if (document.querySelector('.fs-player')) return;

  const node = document.createElement('div');
  node.className = 'fs-player';
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-modal', 'true');
  node.setAttribute('aria-label', 'Full screen player');
  node.innerHTML = `
    <div class="fs-player__head">
      <button class="icon-btn" type="button" data-close aria-label="Close full player">${icon('chevronDown')}</button>
      <span class="dim" style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Now playing</span>
      <button class="icon-btn" type="button" data-queue aria-label="Show queue">${icon('queue')}</button>
    </div>

    <div class="fs-player__body">
      <div data-slot="art" class="fs-art"></div>
      <div class="fs-player__info">
        <div class="fs-player__title truncate" data-slot="title"></div>
        <div class="fs-player__artist truncate" data-slot="artist"></div>
      </div>
    </div>

    <div class="fs-player__bottom">
      <div class="progress" style="max-width:none">
        <span class="progress__time" data-slot="current">0:00</span>
        <input class="range" type="range" min="0" max="100" value="0" step="0.1" data-ctl="seek" aria-label="Seek" />
        <span class="progress__time" data-slot="duration">0:00</span>
      </div>
      <div class="fs-player__controls">
        <button class="icon-btn" type="button" data-ctl="shuffle" aria-label="Shuffle" aria-pressed="false">${icon('shuffle')}</button>
        <button class="icon-btn" type="button" data-ctl="prev" aria-label="Previous track">${icon('prev', { fill: true })}</button>
        <button class="play-btn" type="button" data-ctl="play" aria-label="Play">
          <span class="icon-play">${icon('play', { fill: true })}</span>
          <span class="icon-pause">${icon('pause', { fill: true })}</span>
        </button>
        <button class="icon-btn" type="button" data-ctl="next" aria-label="Next track">${icon('next', { fill: true })}</button>
        <button class="icon-btn" type="button" data-ctl="repeat" aria-label="Repeat: no repeat" aria-haspopup="menu">${icon('repeat')}</button>
      </div>
      <div class="row row--between">
        <button class="icon-btn" type="button" data-ctl="fav" aria-label="Add to favorites">${icon('heart')}</button>
        <div class="volume" style="width:180px">
          <button class="icon-btn icon-btn--sm" type="button" data-ctl="mute" aria-label="Mute">${icon('volume')}</button>
          <input class="range" type="range" min="0" max="1" value="0.8" step="0.01" data-ctl="volume" aria-label="Volume" />
        </div>
        <span style="width:38px"></span>
      </div>
    </div>`;

  const refs = {
    art: node.querySelector('[data-slot="art"]'),
    title: node.querySelector('[data-slot="title"]'),
    artist: node.querySelector('[data-slot="artist"]'),
    play: node.querySelector('[data-ctl="play"]'),
    shuffle: node.querySelector('[data-ctl="shuffle"]'),
    repeat: node.querySelector('[data-ctl="repeat"]'),
    fav: node.querySelector('[data-ctl="fav"]'),
    mute: node.querySelector('[data-ctl="mute"]'),
    volume: node.querySelector('[data-ctl="volume"]'),
    seek: node.querySelector('[data-ctl="seek"]'),
    current: node.querySelector('[data-slot="current"]'),
    duration: node.querySelector('[data-slot="duration"]'),
  };

  let dragging = false;
  const close = () => {
    node.remove();
    unsubscribe?.();
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('no-scroll');
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };

  node.querySelector('[data-close]').addEventListener('click', close);
  node.querySelector('[data-queue]').addEventListener('click', () => {
    close();
    app.store.update('queueOpen', true);
  });
  refs.play.addEventListener('click', () => player.toggle());
  node.querySelector('[data-ctl="prev"]').addEventListener('click', () => player.previous());
  node.querySelector('[data-ctl="next"]').addEventListener('click', () => player.next());
  refs.shuffle.addEventListener('click', () => player.toggleShuffle());
  refs.repeat.addEventListener('click', () => openRepeatMenu(refs.repeat, { placement: 'above' }));
  refs.mute.addEventListener('click', () => player.toggleMute());
  refs.fav.addEventListener('click', () => {
    const track = player.state.currentTrack;
    if (track) app.toggleFavorite(track.id);
  });
  refs.volume.addEventListener('input', () => player.setVolume(Number(refs.volume.value)));
  refs.seek.addEventListener('input', () => {
    dragging = true;
    const ratio = Number(refs.seek.value) / 100;
    refs.current.textContent = formatTime(ratio * player.state.duration);
  });
  const commit = () => {
    if (!dragging) return;
    dragging = false;
    player.seekRatio(Number(refs.seek.value) / 100);
  };
  refs.seek.addEventListener('change', commit);
  refs.seek.addEventListener('pointerup', commit);

  const unsubscribe = player.subscribe((state) => {
    const track = state.currentTrack;
    if (!track) {
      close();
      return;
    }
    node.style.setProperty('--fs-tint', gradientFor(track.artworkSeed || track.albumId));
    refs.art.innerHTML = artworkMarkup({
      seed: track.artworkSeed || track.albumId,
      label: track.album,
      className: 'artwork--lg',
      src: track.artwork || null,
      lazy: false,
    });
    refs.title.textContent = track.title;
    refs.artist.textContent = `${track.artist} · ${track.album}`;

    node.classList.toggle('is-playing', state.isPlaying);
    refs.play.setAttribute('aria-label', state.isPlaying ? 'Pause' : 'Play');
    refs.shuffle.setAttribute('aria-pressed', String(state.shuffle));
    refs.repeat.classList.toggle('is-active', state.repeatMode !== 'off');
    refs.repeat.setAttribute('aria-label', `Repeat: ${REPEAT_LABELS[state.repeatMode]}`);
    refs.repeat.setAttribute('title', REPEAT_LABELS[state.repeatMode]);
    refs.repeat.innerHTML = icon(state.repeatMode === 'one' ? 'repeatOne' : 'repeat');

    const fav = app.isFavorite(track.id);
    refs.fav.classList.toggle('is-fav', fav);
    refs.fav.innerHTML = icon('heart', { fill: fav });
    refs.fav.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');

    const duration = state.duration || 0;
    const ratio = duration ? (state.currentTime / duration) * 100 : 0;
    if (!dragging) {
      refs.seek.value = String(ratio);
      refs.current.textContent = formatTime(state.currentTime);
    }
    refs.duration.textContent = formatTime(duration);
    refs.volume.value = String(state.volume);
    refs.mute.innerHTML = icon(state.muted || state.volume === 0 ? 'mute' : state.volume < 0.5 ? 'volumeLow' : 'volume');
  }, { immediate: true });

  document.addEventListener('keydown', onKey);
  document.body.append(node);
}
