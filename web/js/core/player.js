/**
 * Player engine.
 *
 * Wraps a single <audio> element (HTML5 Audio API, see PRD §23) and owns all
 * playback state: queue, shuffle, repeat, volume, seek and progress.
 *
 * While `USE_MOCK` is true there is no streaming backend yet, so the engine
 * runs on a simulated clock — every control behaves exactly as it will against
 * real audio, letting the entire UI/UX be used and demoed.
 */

import { persisted } from './store.js';
import { clamp, shuffleArray } from './utils.js';
import { USE_MOCK } from './api.js';

export const REPEAT_MODES = ['off', 'all', 'one'];

export function streamUrl(trackId) {
  return `/api/stream/${trackId}`;
}

class Player {
  constructor() {
    this.simulated = USE_MOCK;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.crossOrigin = 'same-origin';
    // Kept in the DOM (hidden) so browser features such as Media Session and
    // background playback behave consistently, and so it is inspectable.
    this.audio.hidden = true;
    this.audio.setAttribute('aria-hidden', 'true');
    document.body?.append(this.audio);

    const savedPositions = persisted.read('positions', {});

    this.state = {
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      isPlaying: false,
      isBuffering: false,
      volume: clamp(persisted.read('volume', 0.8), 0, 1),
      muted: persisted.read('muted', false),
      shuffle: persisted.read('shuffle', false),
      repeatMode: persisted.read('repeat', 'off'),
      currentTime: 0,
      duration: 0,
      simulated: this.simulated,
      error: null,
    };

    this._originalQueue = null;
    this._positions = savedPositions;
    this._listeners = new Set();
    this._trackListeners = new Set();
    this._endedListeners = new Set();
    this._lastTick = 0;
    this._timer = null;

    this._bindAudio();
    this._bindMediaSession();
    this.restoreQueue();
  }

  /* ------------------------------ subscriptions ----------------------------- */

  subscribe(fn, { immediate = false } = {}) {
    this._listeners.add(fn);
    if (immediate) fn(this.state);
    return () => this._listeners.delete(fn);
  }

  on(event, fn) {
    if (event === 'trackchange') this._trackListeners.add(fn);
    if (event === 'ended') this._endedListeners.add(fn);
    return () => {
      this._trackListeners.delete(fn);
      this._endedListeners.delete(fn);
    };
  }

  _emit() {
    for (const fn of this._listeners) fn(this.state);
  }

  _set(patch) {
    this.state = { ...this.state, ...patch };
    this._emit();
  }

  /* --------------------------------- audio --------------------------------- */

  _bindAudio() {
    const a = this.audio;
    a.volume = this.state.muted ? 0 : this.state.volume;

    a.addEventListener('play', () => this._set({ isPlaying: true }));
    a.addEventListener('pause', () => this._set({ isPlaying: false }));
    a.addEventListener('waiting', () => this._set({ isBuffering: true }));
    a.addEventListener('playing', () => this._set({ isBuffering: false, isPlaying: true }));
    a.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(a.duration)) this._set({ duration: a.duration });
    });
    a.addEventListener('timeupdate', () => {
      if (!this.simulated) this._set({ currentTime: a.currentTime });
    });
    a.addEventListener('ended', () => this._handleEnded());
    a.addEventListener('error', () => {
      if (this.simulated) return;
      const track = this.state.currentTrack;
      this._set({ isPlaying: false, isBuffering: false, error: { code: 'STREAM_FAILED', message: `Unable to play "${track?.title ?? 'track'}".` } });
    });
  }

  _bindMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers = {
      play: () => this.resume(),
      pause: () => this.pause(),
      previoustrack: () => this.previous(),
      nexttrack: () => this.next(),
      seekbackward: () => this.seek(this.state.currentTime - 10),
      seekforward: () => this.seek(this.state.currentTime + 10),
      seekto: (details) => {
        if (details.seekTime != null) this.seek(details.seekTime);
      },
    };
    for (const [name, handler] of Object.entries(handlers)) {
      try {
        ms.setActionHandler(name, handler);
      } catch {
        /* unsupported action */
      }
    }
  }

  _updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.artwork ? [{ src: track.artwork, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
  }

  /* --------------------------------- queue --------------------------------- */

  restoreQueue() {
    const saved = persisted.read('queue', null);
    const savedIndex = persisted.read('queueIndex', -1);
    if (!Array.isArray(saved) || !saved.length) return;

    const queue = saved;
    const index = clamp(savedIndex, 0, queue.length - 1);
    this.state.queue = queue;
    this.state.currentIndex = index;
    this.state.currentTrack = queue[index] || null;
    this.state.duration = this.state.currentTrack?.duration || 0;
    this.state.currentTime = this._resumePosition(this.state.currentTrack);
    this._updateMediaSession(this.state.currentTrack);
    this._emit();
  }

  _persistQueue() {
    persisted.write('queue', this.state.queue);
    persisted.write('queueIndex', this.state.currentIndex);
  }

  /** Replace the queue and start playing at `startIndex`. */
  playQueue(tracks, startIndex = 0, { autoplay = true } = {}) {
    if (!tracks?.length) return;
    this._originalQueue = null;
    const index = clamp(startIndex, 0, tracks.length - 1);
    this._set({ queue: tracks.slice(), currentIndex: index, shuffle: false });
    this._loadTrack(index, { autoplay });
  }

  /** Play a single track, keeping the queue it was launched from. */
  play(track, queue = null) {
    if (!track) return;
    if (queue?.length) {
      const index = Math.max(0, queue.findIndex((t) => t.id === track.id));
      this.playQueue(queue, index);
      return;
    }
    const existing = this.state.queue.findIndex((t) => t.id === track.id);
    if (existing >= 0) {
      this._loadTrack(existing, { autoplay: true });
    } else {
      const next = [...this.state.queue, track];
      this._set({ queue: next });
      this._loadTrack(next.length - 1, { autoplay: true });
    }
  }

  _loadTrack(index, { autoplay = true, startFrom = null } = {}) {
    const track = this.state.queue[index];
    if (!track) return;

    this._flushPosition();

    const duration = track.duration || 0;
    const position = startFrom != null ? startFrom : this._resumePosition(track);

    this._set({ currentIndex: index, currentTrack: track, duration, currentTime: position, error: null, isBuffering: true });

    if (!this.simulated) {
      this.audio.src = streamUrl(track.id);
      this.audio.currentTime = position;
    }

    this._updateMediaSession(track);
    this._persistQueue();
    for (const fn of this._trackListeners) fn(track);

    if (autoplay) this.resume();
    else this._set({ isBuffering: false });
  }

  _resumePosition(track) {
    if (!track) return 0;
    const saved = this._positions[track.id];
    if (!saved) return 0;
    const duration = track.duration || 0;
    if (saved < 5 || (duration && saved > duration - 5)) return 0;
    return saved;
  }

  _flushPosition() {
    const { currentTrack, currentTime } = this.state;
    if (!currentTrack) return;
    this._positions[currentTrack.id] = Math.round(currentTime);
    persisted.write('positions', this._positions);
  }

  positionFor(trackId) {
    return this._positions[trackId] || 0;
  }

  /** Jump to an index already in the queue without resetting shuffle. */
  jumpTo(index, { autoplay = true } = {}) {
    if (index < 0 || index >= this.state.queue.length) return;
    this._loadTrack(index, { autoplay, startFrom: 0 });
  }

  /* ------------------------------- transport ------------------------------- */

  resume() {
    if (!this.state.currentTrack) return;
    if (this.simulated) {
      this._lastTick = performance.now();
      this._startTimer();
      this._set({ isPlaying: true, isBuffering: false });
    } else {
      this.audio.play().catch((err) => {
        this._set({ isPlaying: false, error: { code: 'PLAYBACK_BLOCKED', message: err.message } });
      });
    }
    this._setMediaPlaybackState('playing');
  }

  pause() {
    if (this.simulated) {
      this._stopTimer();
      this._set({ isPlaying: false });
    } else {
      this.audio.pause();
    }
    this._flushPosition();
    this._setMediaPlaybackState('paused');
  }

  toggle() {
    if (this.state.isPlaying) this.pause();
    else this.resume();
  }

  next({ auto = false } = {}) {
    const { queue, currentIndex, repeatMode } = this.state;
    if (!queue.length) return;

    if (repeatMode === 'one' && auto) {
      this.seek(0);
      this.resume();
      return;
    }
    let nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all' || !auto) nextIndex = 0;
      else {
        if (this.simulated) this._stopTimer();
        this._set({ isPlaying: false, currentTime: this.state.duration });
        this._setMediaPlaybackState('none');
        return;
      }
    }
    this._loadTrack(nextIndex, { startFrom: 0 });
  }

  previous() {
    const { queue, currentIndex } = this.state;
    if (!queue.length) return;
    if (this.state.currentTime > 3) {
      this.seek(0);
      return;
    }
    const prevIndex = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1;
    this._loadTrack(prevIndex, { startFrom: 0 });
  }

  seek(seconds) {
    const duration = this.state.duration || 0;
    const position = clamp(seconds, 0, duration || seconds);
    if (this.simulated) {
      this._set({ currentTime: position });
      if (this.state.isPlaying) this._lastTick = performance.now();
    } else {
      this.audio.currentTime = position;
      this._set({ currentTime: position });
    }
    this._flushPosition();
  }

  seekRatio(ratio) {
    this.seek(clamp(ratio, 0, 1) * (this.state.duration || 0));
  }

  /* -------------------------------- volume --------------------------------- */

  setVolume(value) {
    const volume = clamp(value, 0, 1);
    this.audio.volume = this.state.muted ? 0 : volume;
    this._set({ volume, muted: volume === 0 ? this.state.muted : false });
    persisted.write('volume', volume);
  }

  setMuted(muted) {
    this.audio.muted = muted;
    this.audio.volume = muted ? 0 : this.state.volume;
    this._set({ muted });
    persisted.write('muted', muted);
  }

  toggleMute() {
    this.setMuted(!this.state.muted);
  }

  /* -------------------------------- shuffle -------------------------------- */

  toggleShuffle() {
    const shuffle = !this.state.shuffle;
    if (shuffle) {
      this._originalQueue = this.state.queue.slice();
      const current = this.state.currentTrack;
      const rest = this.state.queue.filter((t) => t.id !== current?.id);
      const shuffled = current ? [current, ...shuffleArray(rest)] : shuffleArray(rest);
      this._set({ shuffle, queue: shuffled, currentIndex: current ? 0 : -1 });
    } else {
      const original = this._originalQueue || this.state.queue;
      const currentId = this.state.currentTrack?.id;
      const index = currentId ? original.findIndex((t) => t.id === currentId) : -1;
      this._set({ shuffle, queue: original.slice(), currentIndex: index });
      this._originalQueue = null;
    }
    persisted.write('shuffle', shuffle);
    this._persistQueue();
    this._setMediaPlaybackState(this.state.isPlaying ? 'playing' : 'paused');
  }

  /* -------------------------------- repeat --------------------------------- */

  cycleRepeat() {
    const next = REPEAT_MODES[(REPEAT_MODES.indexOf(this.state.repeatMode) + 1) % REPEAT_MODES.length];
    this._set({ repeatMode: next });
    persisted.write('repeat', next);
    return next;
  }

  /* --------------------------- queue manipulation -------------------------- */

  addToQueue(track, { next = false } = {}) {
    const queue = this.state.queue.slice();
    if (next && this.state.currentIndex >= 0) {
      queue.splice(this.state.currentIndex + 1, 0, track);
    } else {
      queue.push(track);
    }
    this._set({ queue });
    this._persistQueue();
  }

  addManyToQueue(tracks, { next = false } = {}) {
    const queue = this.state.queue.slice();
    if (next && this.state.currentIndex >= 0) queue.splice(this.state.currentIndex + 1, 0, ...tracks);
    else queue.push(...tracks);
    this._set({ queue });
    this._persistQueue();
  }

  removeFromQueue(index) {
    const queue = this.state.queue.slice();
    if (index < 0 || index >= queue.length) return;
    const isCurrent = index === this.state.currentIndex;
    queue.splice(index, 1);
    let currentIndex = this.state.currentIndex;
    if (index < currentIndex) currentIndex -= 1;
    else if (isCurrent) currentIndex = Math.min(currentIndex, queue.length - 1);
    this._set({ queue, currentIndex });
    this._persistQueue();
    if (isCurrent) {
      if (queue.length) this._loadTrack(clamp(currentIndex, 0, queue.length - 1), { autoplay: this.state.isPlaying });
      else this.clearQueue();
    }
  }

  moveInQueue(from, to) {
    const queue = this.state.queue.slice();
    if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
    const [item] = queue.splice(from, 1);
    queue.splice(to, 0, item);
    let currentIndex = this.state.currentIndex;
    if (from === currentIndex) currentIndex = to;
    else if (from < currentIndex && to >= currentIndex) currentIndex -= 1;
    else if (from > currentIndex && to <= currentIndex) currentIndex += 1;
    this._set({ queue, currentIndex });
    this._persistQueue();
  }

  clearQueue() {
    this._stopTimer();
    if (!this.simulated) {
      this.audio.pause();
      this.audio.removeAttribute('src');
    }
    this._set({ queue: [], currentIndex: -1, currentTrack: null, isPlaying: false, currentTime: 0, duration: 0 });
    this._updateMediaSession(null);
    this._persistQueue();
  }

  /** Update metadata for a track already in the queue (e.g. favourite flag). */
  patchTrack(trackId, patch) {
    const queue = this.state.queue.map((t) => (t.id === trackId ? { ...t, ...patch } : t));
    const currentTrack = this.state.currentTrack?.id === trackId ? { ...this.state.currentTrack, ...patch } : this.state.currentTrack;
    this._set({ queue, currentTrack });
  }

  /* ------------------------------ simulation ------------------------------- */

  _startTimer() {
    if (this._timer) return;
    this._lastTick = performance.now();
    this._timer = setInterval(() => this._tick(), 200);
  }

  _stopTimer() {
    if (!this._timer) return;
    clearInterval(this._timer);
    this._timer = null;
  }

  _tick() {
    if (!this.state.isPlaying) return;
    const now = performance.now();
    const delta = (now - this._lastTick) / 1000;
    this._lastTick = now;
    const duration = this.state.duration || 0;
    const currentTime = this.state.currentTime + delta;
    if (duration && currentTime >= duration) {
      this._set({ currentTime: duration });
      this._handleEnded();
      return;
    }
    this._set({ currentTime });
  }

  _handleEnded() {
    this._flushPosition();
    for (const fn of this._endedListeners) fn(this.state.currentTrack);
    this.next({ auto: true });
  }

  _setMediaPlaybackState(state) {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state;
  }
}

export const player = new Player();
