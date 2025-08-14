const test = require('node:test');
const assert = require('node:assert');
const sanitizeRoom = require('../utils/sanitizeRoom');

test('allowed characters are preserved and lowercased', () => {
  assert.strictEqual(sanitizeRoom('AbC-123_DEF'), 'abc-123_def');
});

test('strips disallowed characters', () => {
  assert.strictEqual(sanitizeRoom('Hello!@# World?'), 'helloworld');
});

test('trims length to 64 characters', () => {
  const long = 'a'.repeat(70);
  assert.strictEqual(sanitizeRoom(long).length, 64);
});

test("falls back to 'public' on empty input", () => {
  assert.strictEqual(sanitizeRoom(''), 'public');
  assert.strictEqual(sanitizeRoom('???'), 'public');
});
