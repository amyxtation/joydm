import { app } from '../app.js';
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';

export async function renderLogin(root, ctx) {
  document.body.classList.add('auth-mode');

  // A failed status check usually means the API is not running — surface that
  // immediately instead of silently falling through to the sign-in form.
  let statusError = null;
  const status = await api.auth.status().catch((error) => {
    statusError = error;
    return { setupRequired: false };
  });
  const setup = Boolean(status.setupRequired);

  root.innerHTML = `
    <div class="auth">
      <div class="auth__card">
        <div class="auth__brand">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="34" height="34">
              <circle cx="16" cy="16" r="15" fill="url(#joydm-login-g)" />
              <path d="M18.6 8.4v11.2a3.3 3.3 0 1 1-2.2-3.12V11l6.4-1.6v2.1l-4.2 1.05Z" fill="#fff" stroke="none" />
              <defs><linearGradient id="joydm-login-g" x1="0" y1="0" x2="32" y2="32">
                <stop stop-color="#7c5cff" /><stop offset="1" stop-color="#ff5c8a" />
              </linearGradient></defs>
            </svg>
          </span>
          <span class="brand__name">JoyDM</span>
        </div>
        <h1 class="auth__title">${setup ? 'Set up JoyDM' : 'Welcome back'}</h1>
        <p class="auth__sub">${
          setup ? 'Create the administrator account for your music library.' : 'Sign in to your private music library.'
        }</p>

        ${
          statusError
            ? `<div class="auth__warn">${icon('alert')}<span>${escapeHtml(
                statusError.message || 'Cannot reach the JoyDM API.',
              )}</span></div>`
            : ''
        }

        <form class="auth__form" data-slot="form" novalidate>
          <div class="field">
            <label for="login-user">Username</label>
            <input class="input" id="login-user" name="username" autocomplete="username" placeholder="admin" required />
          </div>
          <div class="field">
            <label for="login-pass">Password</label>
            <input class="input" id="login-pass" name="password" type="password" autocomplete="${
              setup ? 'new-password' : 'current-password'
            }" placeholder="${setup ? 'At least 8 characters' : '••••••••'}" required />
          </div>
          ${
            setup
              ? `<div class="field">
                   <label for="login-confirm">Confirm password</label>
                   <input class="input" id="login-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Repeat password" required />
                 </div>`
              : ''
          }
          <div data-slot="error"></div>
          <button class="btn btn--primary btn--block" type="submit" data-slot="submit">${icon('logout')} ${
            setup ? 'Create account' : 'Sign in'
          }</button>
        </form>
        <p class="dim" style="font-size:12px;margin-top:16px;text-align:center">Self-hosted · No tracking · Your music stays on your server</p>
      </div>
    </div>`;

  const form = root.querySelector('[data-slot="form"]');
  const errorSlot = root.querySelector('[data-slot="error"]');
  const submit = root.querySelector('[data-slot="submit"]');
  const idleLabel = `${icon('logout')} ${setup ? 'Create account' : 'Sign in'}`;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorSlot.innerHTML = '';
    const data = new FormData(form);
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');

    if (setup) {
      if (password.length < 8) {
        errorSlot.innerHTML = `<div class="auth__error">Password must be at least 8 characters.</div>`;
        return;
      }
      if (password !== String(data.get('confirm') || '')) {
        errorSlot.innerHTML = `<div class="auth__error">Passwords do not match.</div>`;
        return;
      }
    }

    submit.disabled = true;
    submit.innerHTML = `<span class="spinner"></span> ${setup ? 'Creating…' : 'Signing in…'}`;
    try {
      const user = setup ? await api.auth.setup({ username, password }) : await api.auth.login({ username, password });
      app.store.update('user', user);
      await app.loadShared();
      document.body.classList.remove('auth-mode');
      app.router.navigate(ctx.query.next || '/');
    } catch (error) {
      errorSlot.innerHTML = `<div class="auth__error">${escapeHtml(error.message || 'Sign in failed.')}</div>`;
      submit.disabled = false;
      submit.innerHTML = idleLabel;
    }
  });
}
