import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRange } from '../src/streaming/routes.js';

const SIZE = 1000;

test('parseRange handles explicit start and end', () => {
  assert.deepEqual(parseRange('bytes=0-1023', SIZE), { start: 0, end: 999 });
  assert.deepEqual(parseRange('bytes=100-199', SIZE), { start: 100, end: 199 });
});

test('parseRange handles open-ended ranges', () => {
  assert.deepEqual(parseRange('bytes=500-', SIZE), { start: 500, end: 999 });
});

test('parseRange handles suffix ranges', () => {
  assert.deepEqual(parseRange('bytes=-100', SIZE), { start: 900, end: 999 });
});

test('parseRange clamps an end beyond the file size', () => {
  assert.deepEqual(parseRange('bytes=900-5000', SIZE), { start: 900, end: 999 });
});

test('parseRange rejects unsatisfiable and malformed ranges', () => {
  assert.equal(parseRange('bytes=1000-', SIZE), null, 'start at EOF');
  assert.equal(parseRange('bytes=5000-6000', SIZE), null, 'entirely past EOF');
  assert.equal(parseRange('bytes=-0', SIZE), null, 'zero-length suffix');
  assert.equal(parseRange('bytes=200-100', SIZE), null, 'inverted range');
  assert.equal(parseRange('items=0-10', SIZE), null, 'wrong unit');
  assert.equal(parseRange('bytes=a-b', SIZE), null, 'non-numeric');
  assert.equal(parseRange(undefined, SIZE), null, 'absent header');
});
