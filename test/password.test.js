import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, validatePassword, validateUsername } from '../src/auth/password.js';

test('passwords hash and verify', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
});

test('wrong password does not verify', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.equal(await verifyPassword('Correct horse battery staple', hash), false);
  assert.equal(await verifyPassword('', hash), false);
});

test('hashes are salted (same password, different hash)', async () => {
  const a = await hashPassword('same-password');
  const b = await hashPassword('same-password');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('same-password', b), true);
});

test('malformed or foreign hashes fail closed', async () => {
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
  assert.equal(await verifyPassword('x', 'bcrypt$whatever'), false);
  assert.equal(await verifyPassword('x', null), false);
});

test('password policy requires 8+ characters', () => {
  assert.ok(validatePassword('short'));
  assert.equal(validatePassword('longenough'), null);
  assert.ok(validateUsername('ab'), 'too short');
  assert.ok(validateUsername('has space'));
  assert.equal(validateUsername('admin.user-1'), null);
});
