import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';

const root = () => document.getElementById('toast-root');

export function toast(message, { type = 'info', duration = 2600 } = {}) {
  const host = root();
  if (!host) return;
  const glyph = type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info';
  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  node.setAttribute('role', 'status');
  node.innerHTML = `${icon(glyph)}<span>${escapeHtml(message)}</span>`;
  host.append(node);
  setTimeout(() => {
    node.style.transition = 'opacity 200ms, transform 200ms';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 220);
  }, duration);
}
