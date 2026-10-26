const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nodeCrypto = require('node:crypto');

const features = fs.readFileSync('features.js', 'utf8');
const start = features.indexOf('const PIN_ITER=');
const end = features.indexOf("let buffer='', locked=");
assert.ok(start > 0 && end > start, 'PIN helpers must stay in features.js');

const ctx = {
  W: { crypto: nodeCrypto.webcrypto },
  TextEncoder, Uint8Array, JSON, Math,
  PIN_KEY: 'fr_pin',
  localStorage: { getItem: () => null, setItem: () => {} },
};
vm.runInNewContext(features.slice(start, end) + '\nthis.api={pinKdf,pinHashLegacy,pinCheck,pinRecord,pinBackoffMs,PIN_ITER};', ctx, { timeout: 5000 });
const { pinCheck, pinRecord, pinHashLegacy, pinBackoffMs, PIN_ITER } = ctx.api;

test('new PIN records verify the right PIN and reject others', async () => {
  const rec = await pinRecord('1234', 5);
  assert.equal(rec.v, 2);
  assert.equal(rec.i, PIN_ITER);
  assert.match(rec.s, /^[0-9a-f]{32}$/);
  assert.match(rec.h, /^[0-9a-f]{64}$/);
  assert.equal(rec.n, 4);
  assert.equal(rec.m, 5);
  assert.equal(JSON.stringify(rec).includes('1234'), false, 'PIN must not be stored in clear');
  assert.equal(await pinCheck('1234', rec), true);
  assert.equal(await pinCheck('1235', rec), false);
});

test('the same PIN gets a different salt and hash each time', async () => {
  const a = await pinRecord('123456', 0), b = await pinRecord('123456', 0);
  assert.notEqual(a.s, b.s);
  assert.notEqual(a.h, b.h);
});

test('legacy records (unsalted SHA-256, no v field) still unlock', async () => {
  const legacy = { h: nodeCrypto.createHash('sha256').update('fr-1234').digest('hex'), n: 4, m: 0 };
  assert.equal(await pinHashLegacy('1234'), legacy.h);
  assert.equal(await pinCheck('1234', legacy), true);
  assert.equal(await pinCheck('4321', legacy), false);
});

test('lockout grows with each block of three failures and is capped', () => {
  assert.equal(pinBackoffMs(1), 30000);
  assert.equal(pinBackoffMs(2), 60000);
  assert.equal(pinBackoffMs(3), 120000);
  assert.equal(pinBackoffMs(10), 900000);
});

test('PIN handling no longer keeps the failure counter in memory only', () => {
  assert.doesNotMatch(features, /blockedUntil|failed=0/);
  assert.match(features, /pinStore\(\{\.\.\.config,f,b,u\}\)/);
});
