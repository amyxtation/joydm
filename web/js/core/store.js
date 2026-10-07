/**
 * Minimal reactive store. Views/components subscribe to the slices they care
 * about; there is no virtual DOM — subscribers re-render their own subtree.
 */

export function createStore(initialState) {
  let state = initialState;
  const subscribers = new Set();

  return {
    get() {
      return state;
    },
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      if (next === state) return state;
      state = next;
      for (const fn of subscribers) fn(state);
      return state;
    },
    update(key, value) {
      return this.set({ [key]: value });
    },
    subscribe(fn, { immediate = false } = {}) {
      subscribers.add(fn);
      if (immediate) fn(state);
      return () => subscribers.delete(fn);
    },
  };
}

const PREFIX = 'joydm:';

export const persisted = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable — non-fatal */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* noop */
    }
  },
};

/** Persist a subset of store state to localStorage on change. */
export function persistSlice(store, keys) {
  for (const key of keys) {
    const saved = persisted.read(key, undefined);
    if (saved !== undefined) store.update(key, saved);
  }
  store.subscribe((state) => {
    for (const key of keys) persisted.write(key, state[key]);
  });
}
