import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cookieOptionsFor } from '../src/auth/sessions.js';

test('session cookie is Secure only when the request is HTTPS', () => {
  assert.equal(cookieOptionsFor({ protocol: 'https' }).secure, true);
  assert.equal(cookieOptionsFor({ protocol: 'http' }).secure, false);
});

test('session cookie is always HttpOnly and SameSite=Lax', () => {
  const options = cookieOptionsFor({ protocol: 'http' });
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
});

test('a missing request context degrades to a non-Secure cookie', () => {
  // Never claim Secure when we cannot confirm the scheme, or the browser would
  // silently drop the cookie and logins would appear to fail.
  assert.equal(cookieOptionsFor(undefined).secure, false);
});
