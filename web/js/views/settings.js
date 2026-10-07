import { app } from '../app.js';
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatBytes, formatLongDuration, relativeDate } from '../core/utils.js';
import { toast } from '../ui/toast.js';

export async function renderSettings(root, ctx) {
  const state = app.store.get();
  const user = state.user;
  const stats = state.stats;
  const settings = await api.settings.get().catch(() => ({}));

  root.innerHTML = `
    <div class="page">
      <div class="page-head"><div><h1 class="page-head__title">Settings</h1><p class="page-head__sub">Preferences are stored on this device.</p></div></div>

      <section class="settings-group">
        <div class="settings-group__head"><h3>Appearance</h3><p>Theme is saved to localStorage.</p></div>
        <div class="setting">
          <div><div class="setting__label">Theme</div><div class="setting__desc">Dark is the default JoyDM look.</div></div>
          <div class="setting__control">
            <div class="segmented" data-slot="theme">
              <button type="button" data-action="set-theme" data-value="dark" class="${state.theme === 'dark' ? 'is-active' : ''}">Dark</button>
              <button type="button" data-action="set-theme" data-value="light" class="${state.theme === 'light' ? 'is-active' : ''}">Light</button>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-group">
        <div class="settings-group__head"><h3>Playback</h3><p>How JoyDM behaves when you start listening.</p></div>
        <div class="setting">
          <div><div class="setting__label">Autoplay</div><div class="setting__desc">Start playing as soon as a queue is loaded.</div></div>
          <div class="setting__control">
            <label class="check"><input type="checkbox" data-slot="autoplay" ${settings.autoplay !== false ? 'checked' : ''} /> <span class="muted">Enabled</span></label>
          </div>
        </div>
        <div class="setting">
          <div><div class="setting__label">Crossfade</div><div class="setting__desc">Not part of the MVP — reserved for a future release.</div></div>
          <div class="setting__control"><span class="badge">Coming soon</span></div>
        </div>
      </section>

      <section class="settings-group">
        <div class="settings-group__head"><h3>Library</h3><p>Your music lives on the server; JoyDM only reads it.</p></div>
        <div class="setting">
          <div><div class="setting__label">Library path</div><div class="setting__desc mono">${escapeHtml(state.libraryRoot)}</div></div>
          <div class="setting__control">
            ${user?.role === 'admin' ? `<button class="btn btn--sm btn--primary" type="button" data-action="scan-library">${icon('scan')} Scan library</button>` : ''}
          </div>
        </div>
        <div class="setting">
          <div><div class="setting__label">Library contents</div><div class="setting__desc">${
            stats ? `${stats.tracks} songs · ${stats.albums} albums · ${stats.artists} artists` : '—'
          }</div></div>
          <div class="setting__control"><span class="mono">${stats ? formatBytes(stats.storageUsedBytes) : '—'}</span></div>
        </div>
      </section>

      <section class="settings-group">
        <div class="settings-group__head"><h3>Account</h3><p>Session is secured with an HTTP-only cookie.</p></div>
        <div class="setting">
          <div><div class="setting__label">${escapeHtml(user?.username || 'Not signed in')}</div><div class="setting__desc">${
            user ? `Role: ${escapeHtml(user.role)} · Last login ${relativeDate(user.lastLoginAt)}` : ''
          }</div></div>
          <div class="setting__control"><button class="btn btn--sm btn--danger" type="button" data-action="logout">${icon('logout')} Log out</button></div>
        </div>
      </section>

      <section class="settings-group">
        <div class="settings-group__head"><h3>Keyboard shortcuts</h3><p>Shortcuts never fire while typing in a field.</p></div>
        <div class="setting"><div class="setting__label">Play / Pause</div><div class="setting__control"><span class="mono">Space</span></div></div>
        <div class="setting"><div class="setting__label">Previous / rewind</div><div class="setting__control"><span class="mono">←</span></div></div>
        <div class="setting"><div class="setting__label">Next / forward</div><div class="setting__control"><span class="mono">→</span></div></div>
        <div class="setting"><div class="setting__label">Mute</div><div class="setting__control"><span class="mono">M</span></div></div>
        <div class="setting"><div class="setting__label">Favorite current track</div><div class="setting__control"><span class="mono">F</span></div></div>
        <div class="setting"><div class="setting__label">Focus search</div><div class="setting__control"><span class="mono">/</span></div></div>
      </section>

      <section class="settings-group">
        <div class="settings-group__head"><h3>About</h3><p>JoyDM is private by default — no analytics, no tracking.</p></div>
        <div class="setting"><div class="setting__label">Version</div><div class="setting__control"><span class="mono">0.1.0</span></div></div>
        <div class="setting"><div class="setting__label">Total playtime in library</div><div class="setting__control"><span class="mono">${
          stats ? formatLongDuration(stats.duration) : '—'
        }</span></div></div>
      </section>
    </div>`;

  ctx.setActions({
    'set-theme': (trigger) => {
      app.setTheme(trigger.dataset.value);
      root.querySelectorAll('[data-slot="theme"] button').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.value === trigger.dataset.value);
      });
    },
  });

  const autoplay = root.querySelector('[data-slot="autoplay"]');
  autoplay.addEventListener('change', async () => {
    await api.settings.save({ autoplay: autoplay.checked });
    app.player.state.autoplay = autoplay.checked;
    toast(autoplay.checked ? 'Autoplay on.' : 'Autoplay off.');
  });
}
