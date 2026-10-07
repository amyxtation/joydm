import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';

const stack = [];

/** Opens a centered modal sheet. Returns a handle with `close()` and `panel`. */
export function openSheet({ title = '', body = '', footer = '', wide = false, onMount, onClose } = {}) {
  const host = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet';
  wrap.innerHTML = `
    <div class="sheet__backdrop" data-sheet-close></div>
    <div class="sheet__panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(title || 'Dialog')}" ${
      wide ? 'style="width:min(600px,100%)"' : ''
    }>
      <div class="sheet__head">
        <h2 class="sheet__title">${escapeHtml(title)}</h2>
        <button class="icon-btn icon-btn--sm" type="button" data-sheet-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="sheet__body"></div>
      ${footer ? `<div class="sheet__foot"></div>` : ''}
    </div>`;

  const bodyEl = wrap.querySelector('.sheet__body');
  if (body instanceof Node) bodyEl.append(body);
  else bodyEl.innerHTML = body;
  if (footer) {
    const footEl = wrap.querySelector('.sheet__foot');
    if (footer instanceof Node) footEl.append(footer);
    else footEl.innerHTML = footer;
  }

  const previousFocus = document.activeElement;
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.remove();
    stack.splice(stack.indexOf(handle), 1);
    document.removeEventListener('keydown', onKey);
    if (!stack.length) document.body.style.removeProperty('overflow');
    previousFocus?.focus?.();
    onClose?.();
  };

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };

  wrap.addEventListener('click', (event) => {
    if (event.target.closest('[data-sheet-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';

  host.append(wrap);
  const handle = { close, panel: wrap.querySelector('.sheet__panel'), body: bodyEl };
  stack.push(handle);

  requestAnimationFrame(() => {
    const focusable = wrap.querySelector('input, textarea, select, button:not([data-sheet-close])');
    focusable?.focus?.();
  });
  onMount?.(handle);
  return handle;
}

export function closeTopSheet() {
  const top = stack[stack.length - 1];
  top?.close();
}

/** Promise-based confirm dialog. Resolves to true/false. */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const sheet = openSheet({
      title,
      body: `<p class="muted" style="font-size:14px;line-height:1.6">${escapeHtml(message)}</p>`,
      footer: `
        <button class="btn" type="button" data-cancel>Cancel</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-confirm>${escapeHtml(confirmLabel)}</button>`,
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      },
    });
    sheet.panel.querySelector('[data-cancel]').addEventListener('click', () => sheet.close());
    sheet.panel.querySelector('[data-confirm]').addEventListener('click', () => {
      settled = true;
      sheet.close();
      resolve(true);
    });
  });
}

/** Promise-based single-field form dialog. Resolves to the value or null. */
export function promptDialog({
  title = 'Enter a value',
  label = 'Name',
  placeholder = '',
  value = '',
  multiline = false,
  submitLabel = 'Save',
  hint = '',
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const field = multiline
      ? `<textarea class="textarea" data-input placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
      : `<input class="input" data-input value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />`;
    const sheet = openSheet({
      title,
      body: `<div class="field"><label>${escapeHtml(label)}</label>${field}${
        hint ? `<span class="field__hint">${escapeHtml(hint)}</span>` : ''
      }</div>`,
      footer: `<button class="btn" type="button" data-cancel>Cancel</button><button class="btn btn--primary" type="button" data-submit>${escapeHtml(
        submitLabel,
      )}</button>`,
      onMount: (handle) => handle.panel.querySelector('[data-input]')?.select?.(),
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      },
    });
    const input = sheet.panel.querySelector('[data-input]');
    const submit = () => {
      settled = true;
      const val = input.value.trim();
      sheet.close();
      resolve(val || null);
    };
    sheet.panel.querySelector('[data-submit]').addEventListener('click', submit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !multiline) submit();
    });
  });
}
