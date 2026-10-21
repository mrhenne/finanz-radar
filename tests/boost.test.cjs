const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const boost = fs.readFileSync('boost.js', 'utf8');

test('boost.js is loaded last, after extras.js', () => {
  const order = ['config.js', 'app.js', 'features.js', 'extras.js', 'boost.js'].map(f => html.indexOf('<script src="' + f + '"></script>'));
  order.forEach(i => assert.ok(i > 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('service worker never caches API traffic or writes', () => {
  assert.match(sw, /req\.method !== 'GET'\) return/);
  assert.doesNotMatch(sw, /supabase\.co/);
  assert.doesNotMatch(sw, /coingecko/);
  assert.match(sw, /url\.origin === self\.location\.origin/);
});

test('all splash images referenced in index.html exist', () => {
  const refs = [...html.matchAll(/apple-touch-startup-image"[^>]*href="([^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.length >= 10);
  refs.forEach(r => assert.ok(fs.existsSync(r), r));
});

test('boost.js keeps away from auth, sync and config', () => {
  assert.doesNotMatch(boost, /from\('finance_state'\)|from\('user_state'\)|FR_CONFIG|service_role/);
});
