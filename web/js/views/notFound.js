import { emptyState } from './shared.js';

export async function renderNotFound(root) {
  root.innerHTML = `<div class="page">${emptyState({
    iconName: 'alert',
    title: '404 — Page not found',
    text: 'That page does not exist in JoyDM.',
    action: `<a class="btn btn--primary" data-link href="/">Back home</a>`,
  })}</div>`;
}
