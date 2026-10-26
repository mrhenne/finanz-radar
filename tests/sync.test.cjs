const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');
const { makeServer, makeClient } = require('./harness/fake-supabase.cjs');

// 4.8: Synchronisierung und lokale Datenhaltung. Zwei Geräte teilen einen Fake-Server.
// Zeit wird mit setNow gesteuert (Zeitstempel für Last-Write-Wins). Erfundene Beispielbuchungen.
const T = { t0: '2026-10-26T10:00:00Z', t1: '2026-10-26T10:05:00Z', t2: '2026-10-26T10:10:00Z', t3: '2026-10-26T10:15:00Z', t4: '2026-10-26T10:20:00Z' };
const empty = () => ({ tx: [], as: [], goals: [], rec: [], debts: [], hist: [], sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '', r: 6 } });
const tx = (id, a) => ({ id, d: '2026-10-05', c: 'Lebensmittel', a, n: 'Beispiel ' + id, r: null });

function device(server, now, storage) {
  return loadApp({ now, tz: 'Europe/Berlin', storage, supabase: makeClient(server) });
}
async function login(app, email, pw) {
  await app.settle();
  app.render();
  app.doc.getElementById('le').value = email;
  app.doc.getElementById('lp').value = pw;
  await app.ctx.login(false);
  await app.settle();
}
const addTx = (app, t) => { const s = app.h.S(); s.tx.push(t); app.h.setS(s); app.ctx.save(); };
const readBk = app => app.storage.getItem('fr_bk') || '';
const cloudTxIds = server => (server.finance_state[Object.values(server.users)[0].id] || { data: { tx: [] } }).data.tx.map(x => x.id);

test('zwei Geräte: Änderung auf Gerät A erscheint nach Anmeldung auf Gerät B', async () => {
  const server = makeServer();
  server.addUser('a@example.test', 'geheim123');
  const A = device(server, T.t0);
  await login(A, 'a@example.test', 'geheim123');
  addTx(A, tx('t1', 42));
  await A.settle();
  assert.deepEqual(cloudTxIds(server), ['t1'], 'Gerät A hat hochgeladen');
  const B = device(server, T.t1);
  await login(B, 'a@example.test', 'geheim123');
  assert.deepEqual(B.h.S().tx.map(x => x.id), ['t1'], 'Gerät B hat die Buchung geladen');
});

test('Debounce: mehrere Eingaben innerhalb weniger Sekunden ergeben einen Upload', async () => {
  const server = makeServer();
  server.addUser('a@example.test', 'geheim123');
  const A = device(server, T.t0);
  await login(A, 'a@example.test', 'geheim123');
  const before = server.upserts;
  for (let i = 0; i < 5; i++) addTx(A, tx('d' + i, i + 1));
  await A.settle();
  assert.equal(server.upserts - before, 1);
});

test('Offline: Änderung bleibt lokal, Meldung "Nicht synchronisiert" erscheint, nach Wiederverbindung wird hochgeladen', async () => {
  const server = makeServer();
  server.addUser('a@example.test', 'geheim123');
  const A = device(server, T.t0);
  await login(A, 'a@example.test', 'geheim123');
  server.offline = true;
  addTx(A, tx('off1', 10));
  await A.settle();
  assert.equal(A.h.S().tx.length, 1, 'lokal erhalten');
  assert.match(A.h.sync().syncMsg, /^Nicht synchronisiert/);
  assert.equal(A.h.sync().syncOk, false);
  server.offline = false;
  await A.ctx.push();
  assert.deepEqual(cloudTxIds(server), ['off1']);
});

test('Serverfehler 413 (Daten zu groß): sichtbare Meldung, lokale Daten bleiben', async () => {
  const server = makeServer({ maxBytes: 200 });
  server.addUser('a@example.test', 'geheim123');
  const A = device(server, T.t0);
  await login(A, 'a@example.test', 'geheim123');
  addTx(A, tx('big1', 10));
  await A.settle();
  assert.equal(A.h.S().tx.length, 1);
  assert.equal(A.h.sync().syncOk, false);
  assert.match(A.h.sync().syncMsg, /Nicht synchronisiert: payload too large/);
});

test('Konto-Wechsel auf demselben Gerät: Daten von Konto A sind für Konto B nicht sichtbar', async () => {
  const server = makeServer();
  server.addUser('a@example.test', 'pwa123456');
  server.addUser('b@example.test', 'pwb123456');
  const dev = device(server, T.t0);
  await login(dev, 'a@example.test', 'pwa123456');
  addTx(dev, tx('a-secret', 999));
  await dev.settle();
  dev.ctx.logout(false);
  await dev.settle();
  await login(dev, 'b@example.test', 'pwb123456');
  assert.deepEqual(Array.from(dev.h.S().tx.map(x => x.id)), [], 'keine Buchung von A');
  assert.ok(!readBk(dev).includes('a-secret'), 'Daten von A nicht als Sicherung zurückgelegt');
});

test('Gerät B mit ungesicherten Offline-Änderungen: pull von A darf sie nicht stillschweigend verwerfen', async () => {
  const server = makeServer();
  server.addUser('a@example.test', 'geheim123');
  const A = device(server, T.t0);
  await login(A, 'a@example.test', 'geheim123');
  addTx(A, tx('basis', 1));
  await A.settle();
  const B = device(server, T.t1);
  await login(B, 'a@example.test', 'geheim123');
  server.offline = true;
  addTx(B, tx('offline-b', 77));
  await B.settle(); // Upload scheitert, Änderung nur lokal
  server.offline = false;
  // A ändert danach und lädt hoch (neuerer Stand in der Cloud)
  A.h.setS({ ...A.h.S(), tx: [...A.h.S().tx, tx('neu-a', 5)] });
  A.setNow(T.t3);
  await A.ctx.push();
  // B lädt beim nächsten Start: Cloud ist neuer als B's Stand
  B.setNow(T.t4);
  await B.ctx.pull(true);
  assert.ok(!B.h.S().tx.some(x => x.id === 'offline-b'), 'Auszug: ungesicherte Buchung ist aus dem Stand verschwunden');
  assert.ok(readBk(B).includes('offline-b'), 'Vor dem Überschreiben liegt eine lokale Sicherung mit der Buchung vor');
});

test('Erster Abruf schlägt fehl (Netz aus), dann Änderung: der Upload darf die Cloud nicht mit einem leeren Stand überschreiben', async () => {
  const server = makeServer();
  server.addUser('a@example.test', 'geheim123');
  const A = device(server, T.t0);
  await login(A, 'a@example.test', 'geheim123');
  addTx(A, tx('cloud-1', 10));
  await A.settle();
  const B = device(server, T.t1);
  server.offline = true;
  await login(B, 'a@example.test', 'geheim123'); // Anmeldung klappt, Laden der Cloud nicht
  addTx(B, tx('b-neu', 3));                     // lokale Änderung auf leerem Stand
  server.offline = false;                       // Netz wieder da, bevor der Upload-Timer läuft
  await B.settle();
  assert.deepEqual(cloudTxIds(server), ['cloud-1'], 'Cloud-Stand unverändert');
  assert.ok(readBk(B).includes('b-neu'), 'die lokale Änderung ist gesichert');
});

test('kaputtes fr_s (kein gültiges JSON): App startet mit leerem Stand, Rohdaten werden vorher gesichert', () => {
  const broken = '{"tx":[{"id":"x1"';
  const app = loadApp({ now: T.t0, tz: 'Europe/Berlin', storage: { fr_s: broken } });
  assert.equal(app.h.S().tx.length, 0);
  app.h.setTab('home');
  app.render();
  const keys = [...app.storage.m.keys()].filter(k => k.startsWith('fr_s') && k !== 'fr_s');
  assert.ok(keys.some(k => app.storage.getItem(k) === broken), 'Rohdaten unter eigenem Schlüssel gesichert');
});

test('fr_s mit falscher Struktur (tx als Objekt): wie beim kaputten JSON, Sicherung vorher', () => {
  const bad = '{"tx":{"kein":"liste"}}';
  const app = loadApp({ now: T.t0, tz: 'Europe/Berlin', storage: { fr_s: bad } });
  assert.equal(app.h.S().tx.length, 0);
  const keys = [...app.storage.m.keys()].filter(k => k.startsWith('fr_s') && k !== 'fr_s');
  assert.ok(keys.some(k => app.storage.getItem(k) === bad));
});

test('Altdaten in user_state: erst nach bewusster Entscheidung wird finance_state angelegt', async () => {
  const server = makeServer();
  const uid = server.addUser('a@example.test', 'geheim123');
  server.user_state[uid] = { app_state: { tx: [] }, updated_at: '2025-01-01T00:00:00Z' };
  const A = device(server, T.t0);
  await login(A, 'a@example.test', 'geheim123');
  assert.equal(A.h.sync().legacyPending, true);
  addTx(A, tx('lokal', 1));
  await A.settle();
  assert.equal(server.finance_state[uid], undefined, 'nichts ohne Entscheidung hochgeladen');
  A.setNow(T.t1);
  A.confirms.length = 0;
  await A.ctx.continueWithCurrentData();
  assert.ok(server.finance_state[uid], 'nach Entscheidung angelegt');
  assert.deepEqual(server.user_state[uid].app_state, { tx: [] }, 'user_state unverändert');
});

test('Zwei Geräte laden gleichzeitig hoch: Last-Write-Wins bleibt, die überschriebene Cloud-Fassung liegt vorher in den Sicherungen', async () => {
  const server = makeServer();
  server.addUser('a@example.test', 'geheim123');
  const A = device(server, T.t0);
  await login(A, 'a@example.test', 'geheim123');
  const B = device(server, T.t0);
  await login(B, 'a@example.test', 'geheim123');
  addTx(A, tx('von-a', 1));
  A.setNow(T.t2); await A.settle();
  addTx(B, tx('von-b', 2));
  B.setNow(T.t3); await B.settle(); // B hat den Stand von A noch nicht gesehen
  assert.deepEqual(cloudTxIds(server), ['von-b'], 'letzter Upload gewinnt (Verhalten unverändert)');
  assert.ok(readBk(B).includes('von-a'), 'die überschriebene Fassung von A ist in den Sicherungen von B');
});

test('Abgelaufene Sitzung: Änderungen bleiben lokal, es wird nichts hochgeladen', async () => {
  const server = makeServer();
  server.addUser('a@example.test', 'geheim123');
  const A = device(server, T.t0);
  await login(A, 'a@example.test', 'geheim123');
  A.ctx.logout(false);            // Sitzung endet (SIGNED_OUT)
  await A.settle();
  const before = server.upserts;
  addTx(A, tx('nach-ablauf', 4));
  await A.settle();
  assert.equal(server.upserts, before, 'kein Upload ohne Sitzung');
  assert.equal(A.h.S().tx.length, 1, 'lokal erhalten');
});
