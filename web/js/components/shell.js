import { app } from '../app.js';
import { mountSidebar } from './sidebar.js';
import { mountMobileNav } from './mobileNav.js';
import { mountTopbar } from './topbar.js';
import { mountPlayerBar } from './playerBar.js';
import { mountQueueDrawer } from './queueDrawer.js';

/** Wires the persistent chrome: sidebar, topbar, mobile nav, player, queue. */
export function mountShell() {
  mountSidebar();
  mountTopbar();
  mountMobileNav();
  mountPlayerBar();
  mountQueueDrawer();

  const scrim = document.getElementById('scrim');
  const sidebar = document.getElementById('sidebar');
  const drawer = document.getElementById('queue-drawer');
  const menuBtn = document.getElementById('sidebar-toggle');

  const sync = (state) => {
    sidebar.classList.toggle('is-open', state.sidebarOpen);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(state.sidebarOpen));
    drawer.classList.toggle('is-open', state.queueOpen);
    drawer.setAttribute('aria-hidden', String(!state.queueOpen));
    const open = state.sidebarOpen || state.queueOpen;
    scrim.hidden = !open;
    requestAnimationFrame(() => scrim.classList.toggle('is-open', open));
  };

  app.store.subscribe(sync, { immediate: true });

  scrim.addEventListener('click', () => {
    app.store.set({ sidebarOpen: false, queueOpen: false });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') app.store.set({ sidebarOpen: false, queueOpen: false });
  });

  // Close the mobile sidebar after navigating.
  let lastPath = app.store.get().routePath;
  app.store.subscribe((state) => {
    if (state.routePath !== lastPath) {
      lastPath = state.routePath;
      if (state.sidebarOpen) app.store.update('sidebarOpen', false);
    }
  });
}
