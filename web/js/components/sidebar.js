import { app } from '../app.js';
import { icon } from '../core/icons.js';
import { escapeHtml, formatBytes } from '../core/utils.js';
import { PRIMARY_NAV, SECONDARY_NAV } from './navigation.js';

const SIDEBAR_COUNT = {
  '/songs': (s) => s.stats?.tracks,
  '/artists': (s) => s.stats?.artists,
  '/albums': (s) => s.stats?.albums,
  '/genres': (s) => s.stats?.genres,
  '/playlists': (s) => s.playlists?.length,
  '/favorites': (s) => s.favoriteIds?.length,
};

function navItem(item, state) {
  const active = app.router?.isActive(item.path);
  const countFn = SIDEBAR_COUNT[item.path];
  const count = countFn ? countFn(state) : null;
  return `
    <a class="nav__item ${active ? 'is-active' : ''}" data-link href="${item.path}" ${
      active ? 'aria-current="page"' : ''
    }>
      ${icon(item.icon)}
      <span>${escapeHtml(item.label)}</span>
      ${count != null ? `<span class="nav__count">${count}</span>` : ''}
    </a>`;
}

export function mountSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const footer = document.getElementById('sidebar-footer');

  const render = (state) => {
    const { user } = state;
    const showAdmin = !user || user.role === 'admin';
    nav.innerHTML = `
      <div class="nav__label">Library</div>
      ${PRIMARY_NAV.map((item) => navItem(item, state)).join('')}
      <div class="nav__label">Manage</div>
      ${SECONDARY_NAV.filter((item) => !item.adminOnly || showAdmin).map((item) => navItem(item, state)).join('')}`;

    const used = state.stats?.storageUsedBytes;
    footer.innerHTML = `
      <div class="storage-meter">
        <div class="row row--between" style="font-size:12px">
          <span class="muted">Library storage</span>
          <span class="mono">${used != null ? formatBytes(used) : '—'}</span>
        </div>
        <div class="storage-meter__bar"><div class="storage-meter__fill" style="width:${Math.min(
          100,
          used ? Math.max(6, (used / (20 * 1024 ** 3)) * 100) : 0,
        )}%"></div></div>
        <div class="dim mono" style="font-size:11px">${escapeHtml(state.libraryRoot || '')}</div>
      </div>`;
  };

  app.store.subscribe(render, { immediate: true });
}
