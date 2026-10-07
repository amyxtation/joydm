import { app } from '../app.js';
import { player } from '../core/player.js';
import { icon } from '../core/icons.js';
import { formatTime } from '../core/utils.js';
import { artworkMarkup } from '../ui/artwork.js';

const REPEAT_LABEL = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };

export function mountPlayerBar() {
  const bar = document.getElementById('player-bar');
  let refs = null;
  let renderedTrackId = null;
  let dragging = false;

  function build() {
    bar.innerHTML = `
      <div class="now-playing">
        <button class="icon-btn" type="button" data-action="open-fullscreen" aria-label="Open full player" style="padding:0;width:auto;height:auto">
          <span class="artwork artwork--sm" data-slot="art"></span>
        </button>
        <div class="now-playing__meta">
          <button class="now-playing__title truncate" type="button" data-action="open-fullscreen" style="display:block;max-width:100%;text-align:left">Nothing playing</button>
          <div class="now-playing__artist truncate">—</div>
        </div>
        <button class="icon-btn icon-btn--sm" type="button" data-action="toggle-fav" data-track-id="" aria-label="Add to favorites">${icon('heart')}</button>
      </div>

      <div class="player-center">
        <div class="player-controls">
          <button class="icon-btn" type="button" data-ctl="shuffle" aria-label="Shuffle" aria-pressed="false">${icon('shuffle')}</button>
          <button class="icon-btn" type="button" data-ctl="prev" aria-label="Previous track">${icon('prev', { fill: true })}</button>
          <button class="play-btn" type="button" data-ctl="play" aria-label="Play">
            <span class="icon-play">${icon('play', { fill: true })}</span>
            <span class="icon-pause">${icon('pause', { fill: true })}</span>
          </button>
          <button class="icon-btn" type="button" data-ctl="next" aria-label="Next track">${icon('next', { fill: true })}</button>
          <button class="icon-btn" type="button" data-ctl="repeat" aria-label="Repeat off" aria-pressed="false">${icon('repeat')}</button>
        </div>
        <div class="progress">
          <span class="progress__time" data-slot="current">0:00</span>
          <input class="range" type="range" min="0" max="100" value="0" step="0.1" data-ctl="seek" aria-label="Seek" />
          <span class="progress__time" data-slot="duration">0:00</span>
        </div>
      </div>

      <div class="player-right">
        <button class="icon-btn" type="button" data-action="open-queue" aria-label="Queue">${icon('queue')}</button>
        <div class="volume">
          <button class="icon-btn icon-btn--sm" type="button" data-ctl="mute" aria-label="Mute">${icon('volume')}</button>
          <input class="range" type="range" min="0" max="1" value="0.8" step="0.01" data-ctl="volume" aria-label="Volume" />
        </div>
        <button class="icon-btn" type="button" data-action="open-fullscreen" aria-label="Full screen player">${icon('expand')}</button>
      </div>`;

    refs = {
      art: bar.querySelector('[data-slot="art"]'),
      title: bar.querySelector('.now-playing__title'),
      artist: bar.querySelector('.now-playing__artist'),
      fav: bar.querySelector('[data-action="toggle-fav"]'),
      shuffle: bar.querySelector('[data-ctl="shuffle"]'),
      repeat: bar.querySelector('[data-ctl="repeat"]'),
      play: bar.querySelector('[data-ctl="play"]'),
      seek: bar.querySelector('[data-ctl="seek"]'),
      current: bar.querySelector('[data-slot="current"]'),
      duration: bar.querySelector('[data-slot="duration"]'),
      mute: bar.querySelector('[data-ctl="mute"]'),
      volume: bar.querySelector('[data-ctl="volume"]'),
    };

    refs.play.addEventListener('click', () => player.toggle());
    bar.querySelector('[data-ctl="prev"]').addEventListener('click', () => player.previous());
    bar.querySelector('[data-ctl="next"]').addEventListener('click', () => player.next());
    refs.shuffle.addEventListener('click', () => player.toggleShuffle());
    refs.repeat.addEventListener('click', () => player.cycleRepeat());
    refs.mute.addEventListener('click', () => player.toggleMute());

    refs.seek.addEventListener('input', () => {
      dragging = true;
      const ratio = Number(refs.seek.value) / 100;
      refs.current.textContent = formatTime(ratio * player.state.duration);
      refs.seek.style.setProperty('--fill', `${refs.seek.value}%`);
    });
    const commitSeek = () => {
      if (!dragging) return;
      dragging = false;
      player.seekRatio(Number(refs.seek.value) / 100);
    };
    refs.seek.addEventListener('change', commitSeek);
    refs.seek.addEventListener('pointerup', commitSeek);

    refs.volume.addEventListener('input', () => {
      player.setVolume(Number(refs.volume.value));
      refs.volume.style.setProperty('--fill', `${Number(refs.volume.value) * 100}%`);
    });
    refs.volume.addEventListener('dblclick', () => player.setVolume(0.8));

    bar.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-ctl]');
      if (trigger?.dataset.ctl === 'play') player.toggle();
    });
  }

  function update(state) {
    if (!state.currentTrack) {
      bar.hidden = true;
      renderedTrackId = null;
      return;
    }
    bar.hidden = false;
    if (!refs) build();

    const track = state.currentTrack;
    if (track.id !== renderedTrackId) {
      renderedTrackId = track.id;
      refs.art.outerHTML = artworkMarkup({
        seed: track.artworkSeed || track.albumId,
        label: track.album,
        className: 'artwork--sm',
        src: track.artwork || null,
      }).replace('class="artwork artwork--sm"', 'class="artwork artwork--sm" data-slot="art"');
      refs.art = bar.querySelector('[data-slot="art"]');
      refs.title.textContent = track.title;
      refs.artist.textContent = `${track.artist} — ${track.album}`;
      document.title = `${track.title} · ${track.artist} — JoyDM`;
    }

    bar.classList.toggle('is-playing', state.isPlaying);
    refs.fav.dataset.trackId = track.id;
    const fav = app.isFavorite(track.id);
    refs.fav.classList.toggle('is-fav', fav);
    refs.fav.setAttribute('aria-pressed', String(fav));
    refs.fav.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
    refs.fav.innerHTML = icon('heart', { fill: fav });

    refs.play.setAttribute('aria-label', state.isPlaying ? 'Pause' : 'Play');
    refs.shuffle.setAttribute('aria-pressed', String(state.shuffle));
    refs.repeat.setAttribute('aria-pressed', String(state.repeatMode !== 'off'));
    refs.repeat.setAttribute('aria-label', REPEAT_LABEL[state.repeatMode]);
    refs.repeat.innerHTML = icon(state.repeatMode === 'one' ? 'repeatOne' : 'repeat');

    const duration = state.duration || 0;
    const ratio = duration ? (state.currentTime / duration) * 100 : 0;
    if (!dragging) {
      refs.seek.value = String(ratio);
      refs.current.textContent = formatTime(state.currentTime);
      refs.seek.style.setProperty('--fill', `${ratio}%`);
    }
    refs.duration.textContent = formatTime(duration);

    const vol = state.muted ? 0 : state.volume;
    refs.volume.value = String(state.volume);
    refs.volume.style.setProperty('--fill', `${state.volume * 100}%`);
    refs.mute.innerHTML = icon(state.muted || vol === 0 ? 'mute' : state.volume < 0.5 ? 'volumeLow' : 'volume');
    refs.mute.setAttribute('aria-label', state.muted ? 'Unmute' : 'Mute');
  }

  build();
  bar.hidden = true;
  player.subscribe(update, { immediate: true });
  app.store.subscribe(() => {
    if (player.state.currentTrack) update(player.state);
  });
}
