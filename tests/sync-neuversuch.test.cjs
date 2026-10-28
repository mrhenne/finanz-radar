const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');
const { makeServer, makeClient } = require('./harness/fake-supabase.cjs');

// B-24: Upload-Neuversuch mit Backoff (5 s, 15 s, 45 s, 2 min; insgesamt 5 Versuche), Ereignisse
// „online“ und Rückkehr in den Vordergrund, kein Neuversuch bei 401/403/413. Fake-Server, erfundene Daten.
const EMAIL = 'a@example.test', PW = 'geheim123';
const T = { t0: '2026-10-26T10:00:00Z' };
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
const flush = () => new Promise(r => setImmediate(r));
/* Einen ausstehenden Timer ausführen und die Promise-Kette bis zum nächsten Timer abwarten. */
async function step(app) { app.runTimers(); for (let i = 0; i < 6; i++) await flush(); }
const addTx = (app, t) => { const s = app.h.S(); s.tx.push(t); app.h.setS(s); app.ctx.save(); };
const cloudIds = server => { const row = Object.values(server.finance_state)[0]; return row ? Array.from(row.data.tx.map(x => x.id)) : []; };
const acctText = app => { app.h.setTab('acct'); return app.render(); };

async function setup() {
  const server = makeServer();
  server.addUser(EMAIL, PW);
  const A = device(server, T.t0);
  await login(A);
  return { server, A };
}

test('Netzfehler: Neuversuche nach 5 s, 15 s, 45 s, 2 min, danach Stopp (5 Versuche insgesamt)', async () => {
  const { server, A } = await setup();
  server.offline = true;
  addTx(A, tx('n1', 1));
  await step(A);                                   // Speichern-Timer: erster Versuch schlägt fehl
  assert.deepEqual(A.timerMs(), [5000]);
  assert.match(acctText(A), /Neuer Versuch in 5 s\./, 'Sync-Status zeigt die Restzeit');
  const req0 = server.requests;
  for (const ms of [15000, 45000, 120000]) {
    await step(A);
    assert.deepEqual(A.timerMs(), [ms], 'nächster Versuch nach ' + ms + ' ms');
  }
  await step(A);                                   // fünfter Versuch schlägt fehl: Schluss
  assert.deepEqual(A.timerMs(), [], 'keine weiteren Timer');
  assert.equal(server.requests - req0, 4, 'vier Wiederholungen nach dem ersten Versuch');
  assert.match(A.h.sync().syncMsg, /Automatische Versuche beendet/);
  assert.doesNotMatch(acctText(A), /Neuer Versuch in/);
  await A.settle();
  assert.equal(A.pendingTimers(), 0, 'keine Endlosschleife');
});

test('Neuversuch gelingt: Cloud hat die Änderung, Status zurückgesetzt, neue Fehlerserie beginnt bei 5 s', async () => {
  const { server, A } = await setup();
  server.offline = true;
  addTx(A, tx('n2', 2));
  await step(A);
  await step(A);                                   // zweiter Versuch (15 s) schlägt auch fehl
  server.offline = false;
  await step(A);                                   // dritter Versuch klappt
  assert.deepEqual(cloudIds(server), ['n2'], 'Cloud hat die Buchung');
  assert.equal(A.h.sync().syncOk, true);
  assert.deepEqual(A.timerMs(), []);
  server.offline = true;
  addTx(A, tx('n3', 3));
  await step(A);
  assert.deepEqual(A.timerMs(), [5000], 'neue Serie beginnt wieder bei 5 s');
});

test('Serverfehler 503: Neuversuch; Text verständlich', async () => {
  const { server, A } = await setup();
  server.failures.push({ op: 'select', status: 503 });
  addTx(A, tx('s1', 1));
  await step(A);
  assert.deepEqual(A.timerMs(), [5000]);
  assert.match(A.h.sync().syncMsg, /Die Cloud antwortet gerade nicht/);
});

test('401 Sitzung abgelaufen: kein Neuversuch, verständliche Meldung', async () => {
  const { server, A } = await setup();
  server.failures.push({ op: 'select', status: 401 });
  addTx(A, tx('u1', 1));
  await step(A);
  assert.deepEqual(A.timerMs(), [], 'kein Timer');
  assert.match(A.h.sync().syncMsg, /Sitzung abgelaufen\. Bitte erneut anmelden\./);
  assert.equal(A.h.sync().syncOk, false);
});

test('403 keine Berechtigung: kein Neuversuch', async () => {
  const { server, A } = await setup();
  server.failures.push({ op: 'select', status: 403 });
  addTx(A, tx('f1', 1));
  await step(A);
  assert.deepEqual(A.timerMs(), []);
  assert.match(A.h.sync().syncMsg, /Keine Berechtigung/);
});

test('413 zu groß: kein Neuversuch, verständliche Meldung', async () => {
  const { server, A } = await setup();
  server.failures.push({ op: 'upsert', status: 413 });
  addTx(A, tx('z1', 1));
  await step(A);
  assert.deepEqual(A.timerMs(), []);
  assert.match(A.h.sync().syncMsg, /Der Datenstand ist zu groß für die Cloud/);
});

test('Zeitüberschreitung: nach 20 s abgebrochen, danach Neuversuch', async () => {
  const { server, A } = await setup();
  server.hang = true;
  addTx(A, tx('t1', 1));
  await step(A);                                   // Lesen klappt, Upload hängt
  assert.deepEqual(A.timerMs(), [20000], 'Zeitgrenze läuft');
  await step(A);                                   // Zeitgrenze erreicht
  assert.deepEqual(A.timerMs(), [5000], 'Neuversuch nach dem Abbruch');
  assert.match(A.h.sync().syncMsg, /Zeitüberschreitung/);
});

test('„wieder online“ startet sofort einen Versuch (kein Warten bis zum Timer)', async () => {
  const { server, A } = await setup();
  server.offline = true;
  addTx(A, tx('o1', 1));
  await step(A);
  assert.deepEqual(A.timerMs(), [5000]);
  server.offline = false;
  A.fire('online');
  await flush();
  assert.deepEqual(cloudIds(server), ['o1'], 'hochgeladen ohne Warten');
  assert.ok(!A.timerMs().includes(5000) && !A.timerMs().includes(15000), 'kein Neuversuch-Timer mehr (Toast-Timer bleibt)');
  assert.doesNotMatch(acctText(A), /Neuer Versuch in/);
});

test('Rückkehr in den Vordergrund startet einen Versuch; im Hintergrund nicht', async () => {
  const { server, A } = await setup();
  server.offline = true;
  addTx(A, tx('v1', 1));
  await step(A);
  const before = server.requests;
  A.doc.hidden = true;
  A.fire('visibilitychange');
  await flush();
  assert.equal(server.requests, before, 'im Hintergrund kein Versuch');
  A.doc.hidden = false;
  server.offline = false;
  A.fire('visibilitychange');
  await flush();
  assert.deepEqual(cloudIds(server), ['v1'], 'nach Rückkehr hochgeladen');
});

test('Ereignisse ohne ausstehende Änderung lösen keinen Upload aus', async () => {
  const { server, A } = await setup();
  const before = server.requests;
  A.fire('online');
  A.doc.hidden = false;
  A.fire('visibilitychange');
  await flush();
  assert.equal(server.requests, before);
});

test('Timer-Leck: nach Abmeldung läuft kein Neuversuch mehr', async () => {
  const { server, A } = await setup();
  server.offline = true;
  addTx(A, tx('l1', 1));
  await step(A);
  assert.deepEqual(A.timerMs(), [5000]);
  await A.ctx.logout(false);
  await A.settle();
  assert.equal(A.pendingTimers(), 0, 'keine Timer nach Abmeldung');
  const before = server.requests;
  await A.settle();
  assert.equal(server.requests, before, 'kein Versuch nach Abmeldung');
});
