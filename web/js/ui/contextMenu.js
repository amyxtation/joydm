/**
 * Lightweight context menu used by track rows, cards and the queue.
 * Accepts items: `{ label, icon, onClick, danger }` or `'-'` for a separator,
 * or `{ label, header: true }` for a section label.
 */
export function openContextMenu(x, y, items) {
  closeContextMenu();
  const host = document.getElementById('context-menu-root');
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.setAttribute('role', 'menu');

  for (const item of items) {
    if (!item) continue;
    if (item === '-') {
      menu.insertAdjacentHTML('beforeend', '<div class="context-menu__sep"></div>');
      continue;
    }
    if (item.header) {
      menu.insertAdjacentHTML('beforeend', `<div class="context-menu__label">${item.label}</div>`);
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `context-menu__item${item.danger ? ' context-menu__item--danger' : ''}`;
    button.setAttribute('role', 'menuitem');
    button.innerHTML = item.icon ? `${item.icon}<span>${item.label}</span>` : `<span>${item.label}</span>`;
    button.addEventListener('click', () => {
      closeContextMenu();
      item.onClick?.();
    });
    menu.append(button);
  }

  host.append(menu);
  const rect = menu.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 8);
  const py = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, px)}px`;
  menu.style.top = `${Math.max(8, py)}px`;

  const dismiss = (event) => {
    if (menu.contains(event.target)) return;
    closeContextMenu();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('scroll', closeContextMenu, { once: true, capture: true });
    window.addEventListener('resize', closeContextMenu, { once: true });
    document.addEventListener('keydown', onKey);
  });

  function onKey(event) {
    if (event.key === 'Escape') closeContextMenu();
  }

  menu._dismiss = dismiss;
  menu._onKey = onKey;
}

export function closeContextMenu() {
  const host = document.getElementById('context-menu-root');
  if (!host) return;
  for (const menu of host.children) {
    if (menu._dismiss) document.removeEventListener('pointerdown', menu._dismiss);
    if (menu._onKey) document.removeEventListener('keydown', menu._onKey);
  }
  host.innerHTML = '';
}

export function contextMenuFromEvent(event, items) {
  event.preventDefault();
  event.stopPropagation();
  openContextMenu(event.clientX, event.clientY, items);
}
