const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app.js', 'utf8');
const start = app.indexOf('function sanitizeImportedValue');
const end = app.indexOf("\ntry{const j=localStorage.getItem('fr_s')", start);
assert.ok(start >= 0 && end > start, 'Import validation functions must remain in app.js');

let generatedId = 0;
const context = { uid: () => 'test_' + (++generatedId) };
vm.runInNewContext(
  app.slice(start, end) + '\nthis.importSafety = { sanitizeImportedValue, normalizeImportedState };',
  context,
  { timeout: 1000 }
);
const { sanitizeImportedValue, normalizeImportedState } = context.importSafety;
const plain = value => JSON.parse(JSON.stringify(value));

test('normalizes a valid state and fills missing collections', () => {
  const state = plain(normalizeImportedState({
    tx: [{ id: 'valid_1', d: '2026-01-01', c: 'Gehalt', a: 1234, n: 'Monat' }]
  }));
  assert.equal(state.tx.length, 1);
  assert.equal(state.tx[0].id, 'valid_1');
  assert.equal(state.tx[0].a, 1234);
  assert.deepEqual(state.as, []);
  assert.deepEqual(state.goals, []);
  assert.deepEqual(state.debts, []);
  assert.equal(state.th, 'light');
  assert.equal(state.f.wr, 4);
});

test('strips markup/control characters and caps strings', () => {
  const clean = sanitizeImportedValue('Haus & Hof <img src=x>\u0000"' + 'x'.repeat(5100));
  assert.equal(clean.includes('<'), false);
  assert.equal(clean.includes('>'), false);
  assert.equal(clean.includes('&'), false);
  assert.equal(clean.includes('"'), false);
  assert.equal(clean.includes('\u0000'), false);
  assert.ok(clean.length <= 5000);
});

test('regenerates unsafe record IDs and validates record collections', () => {
  const state = plain(normalizeImportedState({
    tx: [{ id: "bad id';alert(1)//", d: '2026-01-01', c: 'Sonstiges', a: 1, n: 'Test' }]
  }));
  assert.match(state.tx[0].id, /^test_\d+$/);
  assert.throws(() => normalizeImportedState([]), /JSON-Objekt/);
  assert.throws(() => normalizeImportedState({ tx: {} }), /tx muss eine Liste sein/);
  assert.throws(() => normalizeImportedState({ tx: [null] }), /Ungültiger Datensatz/);
});

test('rejects oversized or excessively nested input', () => {
  assert.throws(() => sanitizeImportedValue(Array(20001).fill(0)), /Zu viele Einträge/);
  let nested = 'leaf';
  for (let i = 0; i < 14; i++) nested = { child: nested };
  assert.throws(() => sanitizeImportedValue(nested), /zu tief verschachtelt/);
});

test('drops prototype-related properties from imported JSON', () => {
  const hostile = JSON.parse('{"ordinary":"ok","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
  const clean = plain(sanitizeImportedValue(hostile));
  assert.equal(clean.ordinary, 'ok');
  assert.equal(Object.hasOwn(clean, '__proto__'), false);
  assert.equal(Object.hasOwn(clean, 'constructor'), false);
});
