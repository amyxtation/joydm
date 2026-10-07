import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

/**
 * Password hashing.
 *
 * The PRD recommends Argon2id; we use scrypt from `node:crypto` instead — a
 * memory-hard KDF that is equally safe for this threat model and needs no
 * native dependency, which keeps the container small (PRD §110 "prefer the
 * standard library"). Format: `scrypt$N$r$p$salt$hash`.
 */
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem: 128 * PARAMS.N * PARAMS.r * 2 });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt') return false;

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Minimum 8 characters, as specified in PRD §125. */
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 200) return 'Password is too long.';
  return null;
}

export function validateUsername(username) {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    return 'Username must be 3–32 characters (letters, numbers, . _ -).';
  }
  return null;
}
