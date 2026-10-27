const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');
const { makeServer, makeClient } = require('./harness/fake-supabase.cjs');

// B-03: Konflikt-Dialog statt Last-Write-Wins. Zwei Geräte teilen einen Fake-Server (kein Supabase).
// Erfundene Beispieldaten, feste Zeitpunkte über setNow.
const EMAIL = 'a@example.test', PW = 'geheim123';
const T = { t0: '2026-10-26T10:00:00Z', t2: '2026-10-26T10:10:00Z', t3: '2026-10-26T10:15:00Z', t4: '2026-10-26T10:20:00Z' };
const tx = (id, a) => ({ id, d: '2026-10-05', c: 'Lebensmittel', a, n: 'Beispiel ' + id, r: null });

function device(server, now, storage) {
  return loadApp({ now, tz: 'Europe/Berlin', storage, supabase: makeClient(server) });
}
async function login(app) {
  await app.settle();
  app.render();
  app.doc.getElementById('le').value = EMAIL;
  app.doc.getElementById('lp').value = PW;
  await app.ctx.login(false);
  await app.settle();
}
const addTx = (app, t) => { const s = app.h.S(); s.tx.push(t); app.h.setS(s); app.ctx.save(); };
const ids = app => Array.from(app.h.S().tx.map(x => x.id)); // Array.from: Arrays aus dem vm-Kontext sind sonst nicht deepStrictEqual-gleich
const cloudIds = server => { const row = Object.values(server.finance_state)[0]; return row ? Array.from(row.data.tx.map(x => x.id)) : []; };
const bkIds = (app, kind) => Array.from(JSON.parse(app.storage.getItem('fr_bk') || '[]').filter(e => e.k === kind).flatMap(e => JSON.parse(e.d).tx.map(x => x.id)));
const konfliktOffen = app => /id="kf"/.test(app.render());
const pausiert = app => /Synchronisierung pausiert|Cloud-Stand ist neuer/.test(app.render());

/* Gerät A und B sind angemeldet, beide ändern offline, A lädt zuerst hoch, B lädt danach mit Konflikt. */
async function zweiGeraeteOffline() {
  const server = makeServer();
  server.addUser(EMAIL, PW);
  const A = device(server, T.t0); await login(A);
  const B = device(server, T.t0); await login(B);
  server.offline = true;
  addTx(A, tx('a-off', 1));
  addTx(B, tx('b-off', 2));
  await A.settle();
  await B.settle();
  server.offline = false;
  A.setNow(T.t2); await A.ctx.push();
  B.setNow(T.t3); await B.ctx.push();
  return { server, A, B };
}

test('zwei Geräte beide offline geändert: Dialog erscheint, nichts wird überschrieben', async () => {
  const { server, B } = await zweiGeraeteOffline();
  assert.deepEqual(cloudIds(server), ['a-off'], 'Cloud hat den Stand von A');
  assert.deepEqual(ids(B), ['b-off'], 'B behält seine Änderung');
  assert.ok(konfliktOffen(B), 'Dialog ist offen');
  assert.equal(B.doc.activeElement.id, 'kf_b1', 'Fokus liegt im Dialog');
  assert.equal(B.h.sync().syncOk, false);
});

test('Entscheidung „Cloud-Stand übernehmen“: lokale Fassung vorher in den Sicherungen, kein Upload', async () => {
  const { server, B } = await zweiGeraeteOffline();
  const before = server.upserts;
  await B.ctx.konfliktWahl('uebernehmen');
  await B.settle();
  assert.deepEqual(ids(B), ['a-off'], 'B hat den Cloud-Stand');
  assert.deepEqual(bkIds(B, 'vor-cloud'), ['b-off'], 'lokale Fassung ist in den Sicherungen');
  assert.deepEqual(cloudIds(server), ['a-off'], 'Cloud unverändert');
  assert.equal(server.upserts, before, 'kein Upload');
  assert.equal(konfliktOffen(B), false);
  assert.doesNotMatch(B.render(), /Cloud-Stand ist neuer|Synchronisierung pausiert/);
  assert.equal(B.storage.getItem('fr_dirty'), null, 'nichts mehr als ungesichert markiert');
});

test('Entscheidung „Diesen Stand behalten“: Cloud-Fassung vorher in den Sicherungen, dann Upload', async () => {
  const { server, B } = await zweiGeraeteOffline();
  await B.ctx.konfliktWahl('behalten');
  await B.settle();
  assert.deepEqual(cloudIds(server), ['b-off'], 'der Stand von B ist in der Cloud');
  assert.deepEqual(bkIds(B, 'cloud'), ['a-off'], 'Cloud-Fassung ist vorher in den Sicherungen');
  assert.deepEqual(ids(B), ['b-off'], 'B behält seinen Stand');
  assert.equal(konfliktOffen(B), false);
  assert.doesNotMatch(B.render(), /Cloud-Stand ist neuer|Synchronisierung pausiert/);
  assert.equal(B.storage.getItem('fr_dirty'), null);
});

test('Entscheidung „Später entscheiden“: nichts geändert, Banner bleibt, Sync bleibt pausiert', async () => {
  const { server, B } = await zweiGeraeteOffline();
  await B.ctx.konfliktWahl('spaeter');
  assert.equal(konfliktOffen(B), false, 'Dialog zu');
  assert.match(B.render(), /Synchronisierung pausiert/, 'Banner bleibt sichtbar');
  const before = server.upserts;
  addTx(B, tx('b-mehr', 3));
  await B.settle();
  assert.equal(server.upserts, before, 'kein Upload während des Konflikts');
  assert.deepEqual(cloudIds(server), ['a-off'], 'Cloud unverändert');
  assert.deepEqual(ids(B), ['b-off', 'b-mehr'], 'lokale Änderungen bleiben');
  assert.equal(B.storage.getItem('fr_dirty'), '1', 'Änderungen bleiben als ungesichert markiert');
});

test('App-Neustart während des Konflikts: nach Anmeldung erscheint der Dialog wieder, nichts wird hochgeladen', async () => {
  const { server, B } = await zweiGeraeteOffline();
  const before = server.upserts;
  const C = device(server, T.t4, Object.fromEntries(B.storage.m));
  await login(C);
  assert.ok(konfliktOffen(C), 'Dialog nach Neustart');
  assert.deepEqual(ids(C), ['b-off'], 'lokale Änderung ist noch da');
  assert.deepEqual(cloudIds(server), ['a-off'], 'Cloud unverändert');
  assert.equal(server.upserts, before, 'kein Upload beim Start');
});

test('identische Inhalte auf beiden Geräten erzeugen keinen Dialog', async () => {
  const server = makeServer();
  server.addUser(EMAIL, PW);
  const A = device(server, T.t0); await login(A);
  const B = device(server, T.t0); await login(B);
  server.offline = true;
  addTx(A, tx('gleich', 7));
  addTx(B, tx('gleich', 7));
  await A.settle();
  await B.settle();
  server.offline = false;
  A.setNow(T.t2); await A.ctx.push();
  B.setNow(T.t3); await B.ctx.push();
  assert.equal(konfliktOffen(B), false, 'kein Dialog');
  assert.doesNotMatch(B.render(), /Synchronisierung pausiert/);
  assert.deepEqual(ids(B), ['gleich']);
  assert.equal(B.h.sync().syncOk, true, 'Cloud-Stand wurde übernommen');
  assert.equal(B.storage.getItem('fr_dirty'), null);
});

test('Normalfall: lokal ohne ungesicherte Änderung, Cloud neuer: Cloud wird geladen, kein Dialog', async () => {
  const server = makeServer();
  server.addUser(EMAIL, PW);
  const A = device(server, T.t0); await login(A);
  const B = device(server, T.t0); await login(B);
  A.setNow(T.t2);
  addTx(A, tx('neu', 5));
  await A.settle();
  B.setNow(T.t3);
  await B.ctx.pull(true);
  assert.deepEqual(ids(B), ['neu'], 'Cloud-Stand geladen');
  assert.equal(konfliktOffen(B), false);
  assert.doesNotMatch(B.render(), /Synchronisierung pausiert/);
});

test('Tastatur im Dialog: Esc schließt (wie Später), Tab bleibt in den drei Schaltflächen', async () => {
  const { B } = await zweiGeraeteOffline();
  assert.ok(konfliktOffen(B));
  const onKey = B.doc.listeners.keydown[0];
  onKey({ key: 'Escape', shiftKey: false, preventDefault() {} });
  assert.equal(konfliktOffen(B), false, 'Esc schließt den Dialog');
  assert.match(B.render(), /Synchronisierung pausiert/, 'Banner bleibt');
  B.evalApp('kfOpen = true; render();');
  B.doc.getElementById('kf_b3').focus();
  let prevented = false;
  onKey({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(B.doc.activeElement.id, 'kf_b1', 'Tab am letzten Element springt zum ersten');
  onKey({ key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(B.doc.activeElement.id, 'kf_b3', 'Shift+Tab am ersten springt zum letzten');
});
