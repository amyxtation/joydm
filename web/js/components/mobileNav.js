import { app } from '../app.js';
import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';
import { MOBILE_NAV } from './navigation.js';

export function mountMobileNav() {
  const nav = document.getElementById('mobile-nav');
  const render = () => {
    nav.innerHTML = MOBILE_NAV.map((item) => {
      const active = app.router?.isActive(item.path);
      return `<a class="mobile-nav__item ${active ? 'is-active' : ''}" data-link href="${item.path}" ${
        active ? 'aria-current="page"' : ''
      }>${icon(item.icon)}<span>${escapeHtml(item.label)}</span></a>`;
    }).join('');
  };
  app.store.subscribe(render, { immediate: true });
}
