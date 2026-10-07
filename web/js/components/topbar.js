import { app } from '../app.js';
import { icon } from '../core/icons.js';
import { escapeHtml, debounce } from '../core/utils.js';
import { openContextMenu } from '../ui/contextMenu.js';

export function mountTopbar() {
  const form = document.getElementById('global-search');
  const input = document.getElementById('search-input');
  const themeBtn = document.getElementById('theme-toggle');
  const userBtn = document.getElementById('user-menu-btn');
  const backBtn = document.getElementById('history-back');
  const menuBtn = document.getElementById('sidebar-toggle');

  const goSearch = (q) => {
    const query = q.trim();
    if (!query) return;
    app.router.navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    goSearch(input.value);
    input.blur();
  });

  input.addEventListener(
    'input',
    debounce(() => {
      const q = input.value.trim();
      if (q.length >= 2) goSearch(q);
    }, 420),
  );

  themeBtn.addEventListener('click', () => app.toggleTheme());

  backBtn.addEventListener('click', (event) => {
    event.preventDefault();
    history.back();
  });

  menuBtn.addEventListener('click', () => {
    app.store.update('sidebarOpen', !app.store.get().sidebarOpen);
  });

  userBtn.addEventListener('click', () => {
    const { user } = app.store.get();
    const rect = userBtn.getBoundingClientRect();
    const items = [
      { header: true, label: escapeHtml(user ? `${user.username} · ${user.role}` : 'Not signed in') },
      { label: 'Settings', icon: icon('settings'), onClick: () => app.router.navigate('/settings') },
    ];
    if (user?.role === 'admin') {
      items.push({ label: 'Admin dashboard', icon: icon('shield'), onClick: () => app.router.navigate('/admin') });
    }
    items.push('-', { label: 'Log out', icon: icon('logout'), danger: true, onClick: () => app.logout() });
    openContextMenu(rect.right - 210, rect.bottom + 8, items);
  });

  app.store.subscribe((state) => {
    const path = state.routePath || '/';
    backBtn.hidden = path === '/' || path === '/login';
    const avatar = document.getElementById('user-avatar');
    const name = state.user?.username || 'J';
    avatar.textContent = name.slice(0, 1).toUpperCase();
    if (!input.value && path === '/search') input.value = new URLSearchParams(location.search).get('q') || '';
  }, { immediate: true });
}
