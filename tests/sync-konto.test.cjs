const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');
const { makeServer, makeClient } = require('./harness/fake-supabase.cjs');

// B-25: Kontowechsel. Ungesicherte Änderungen des vorherigen Kontos werden nicht still verworfen,
// Daten des alten Kontos erscheinen nie im neuen Konto. Erfundene Beispieldaten, Fake-Server.
const A = { email: 'a@example.test', pw: 'pwa123456' }, B = { email: 'b@example.test', pw: 'pwb123456' };
const T = { t0: '2026-10-26T10:00:00Z', t1: '2026-10-26T10:05:00Z', t2: '2026-10-26T10:10:00Z' };
const TABS = ['home', 'cash', 'assets', 'fire', 'plan', 'more', 'goals', 'tax', 'data', 'year', 'port', 'crypto', 'acct', 'review', 'rebal', 'csv', 'sec', 'passive', 'job'];
const tx = (id, a) => ({ id, d: '2026-10-05', c: 'Lebensmittel', a, n: 'Beispiel ' + id, r: null });

function device(server, now, storage) {
  return loadApp({ now, tz: 'Europe/Berlin', storage, supabase: makeClient(server) });
}
async function login(app, who) {
  await app.settle();
  app.render();
  app.doc.getElementById('le').value = who.email;
  app.doc.getElementById('lp').value = who.pw;
  await app.ctx.login(false);
  await app.settle();
}
const addTx = (app, t) => { const s = app.h.S(); s.tx.push(t); app.h.setS(s); app.ctx.save(); };
const ids = app => Array.from(app.h.S().tx.map(x => x.id));
const uidOf = (server, who) => server.users[who.email].id;
const cloudIds = (server, who) => { const row = server.finance_state[uidOf(server, who)]; return row ? Array.from(row.data.tx.map(x => x.id)) : []; };
const dialogOffen = app => /id="kf"/.test(app.render());
const bkText = app => app.storage.getItem('fr_bk') || '';

/* Konto A hat eine hochgeladene Buchung und eine ungesicherte (offline). A meldet sich ab. */
async function altesKontoMitUngesichert() {
  const server = makeServer();
  server.addUser(A.email, A.pw);
  server.addUser(B.email, B.pw);
  const dev = device(server, T.t0);
  await login(dev, A);
  addTx(dev, tx('a-basis', 1));
  await dev.settle();
  server.offline = true;
  addTx(dev, tx('a-offen', 2));
  await dev.settle();
  server.offline = false;
  await dev.ctx.logout(false);
  await dev.settle();
  return { server, dev };
}

test('anderes Konto mit ungesicherten Änderungen: Dialog, keine Daten des alten Kontos, kein Upload', async () => {
  const { server, dev } = await altesKontoMitUngesichert();
  const before = server.upserts;
  await login(dev, B);
  assert.ok(dialogOffen(dev), 'Dialog „Anderes Konto angemeldet“ ist offen');
  assert.equal(dev.doc.activeElement.id, 'kf_b1', 'Fokus liegt im Dialog');
  assert.doesNotMatch(dev.render(), /a-offen|a-basis|Beispiel/, 'keine Buchung des alten Kontos sichtbar');
  assert.equal(server.upserts, before, 'kein Upload für das neue Konto');
  assert.equal(cloudIds(server, B).length, 0, 'Cloud von B unberührt');
  assert.deepEqual(ids(dev), ['a-basis', 'a-offen'], 'Stand des alten Kontos bleibt bis zur Entscheidung');
  assert.equal(dev.storage.getItem('fr_dirty'), '1');
});

test('Verwerfen und wechseln: alte Änderungen weg, nicht in Sicherungen, neues Konto ohne Daten von A', async () => {
  const { server, dev } = await altesKontoMitUngesichert();
  await login(dev, B);
  await dev.ctx.kontoWahl('verwerfen');
  await dev.settle();
  assert.deepEqual(ids(dev), [], 'keine Buchung von A');
  assert.equal(dialogOffen(dev), false);
  assert.ok(!bkText(dev).includes('a-offen') && !bkText(dev).includes('a-basis'), 'nicht als Sicherung abgelegt');
  assert.deepEqual(cloudIds(server, B), [], 'Cloud von B enthält keine Daten von A');
  assert.ok(!JSON.stringify(server.finance_state).includes('a-offen'), 'nirgends in der Cloud');
  assert.equal(dev.storage.getItem('fr_dirty'), null);
});

test('Als Datei sichern und wechseln: JSON-Export wird ausgelöst, danach wechselt die App', async () => {
  const { server, dev } = await altesKontoMitUngesichert();
  await login(dev, B);
  await dev.ctx.kontoWahl('sichern');
  await dev.settle();
  assert.ok(dev.storage.getItem('fr_exp'), 'Datei-Export ist gespeichert worden (fr_exp)');
  assert.deepEqual(ids(dev), [], 'danach der leere Stand von B');
  assert.deepEqual(cloudIds(server, B), []);
  assert.equal(dialogOffen(dev), false);
});

test('Abbrechen: neues Konto wird abgemeldet, alter Stand bleibt unverändert', async () => {
  const { server, dev } = await altesKontoMitUngesichert();
  await login(dev, B);
  await dev.ctx.kontoWahl('abbrechen');
  await dev.settle();
  assert.equal(dev.h.getUser(), null, 'B ist abgemeldet');
  assert.match(dev.render(), /id="le"/, 'Anmeldeformular');
  assert.deepEqual(ids(dev), ['a-basis', 'a-offen'], 'Stand von A unverändert');
  assert.equal(dev.storage.getItem('fr_dirty'), '1', 'ungesicherte Änderungen bleiben');
  assert.equal(server.finance_state[uidOf(server, B)], undefined, 'Cloud von B unberührt');
});

test('Esc im Konto-Dialog wirkt wie Abbrechen', async () => {
  const { dev } = await altesKontoMitUngesichert();
  await login(dev, B);
  dev.doc.listeners.keydown[0]({ key: 'Escape', shiftKey: false, preventDefault() {} });
  await dev.settle();
  assert.equal(dev.h.getUser(), null);
  assert.deepEqual(ids(dev), ['a-basis', 'a-offen']);
});

test('Tab im Konto-Dialog bleibt in den drei Schaltflächen', async () => {
  const { dev } = await altesKontoMitUngesichert();
  await login(dev, B);
  const onKey = dev.doc.listeners.keydown[0];
  dev.doc.getElementById('kf_b3').focus();
  onKey({ key: 'Tab', shiftKey: false, preventDefault() {} });
  assert.equal(dev.doc.activeElement.id, 'kf_b1');
  onKey({ key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(dev.doc.activeElement.id, 'kf_b3');
});

test('im Konto-Dialog zeigt keine Ansicht Daten des alten Kontos (alle Reiter)', async () => {
  const { dev } = await altesKontoMitUngesichert();
  await login(dev, B);
  for (const t of TABS) {
    dev.h.setTab(t);
    const html = dev.render();
    assert.doesNotMatch(html, /a-offen|a-basis/, 'Reiter ' + t);
  }
});

test('ohne ungesicherte Änderungen wechselt die App ohne Dialog', async () => {
  const server = makeServer();
  server.addUser(A.email, A.pw);
  server.addUser(B.email, B.pw);
  const dev = device(server, T.t0);
  await login(dev, A);
  addTx(dev, tx('a-sauber', 1));
  await dev.settle();
  await dev.ctx.logout(false);
  await dev.settle();
  await login(dev, B);
  assert.equal(dialogOffen(dev), false, 'kein Dialog');
  assert.deepEqual(ids(dev), [], 'keine Buchung von A');
  assert.doesNotMatch(dev.render(), /a-sauber/);
});

test('Sitzungswechsel ohne Abmeldung gilt wie eine Anmeldung: keine Daten von A unter B', async () => {
  const server = makeServer();
  server.addUser(A.email, A.pw);
  server.addUser(B.email, B.pw);
  const dev = device(server, T.t0);
  await login(dev, A);
  addTx(dev, tx('a-sauber', 1));
  await dev.settle();
  // Sitzung wechselt direkt (ohne Abmeldung); das Anmeldefeld ist dabei nicht sichtbar
  await dev.evalApp('sb').auth.signInWithPassword({ email: B.email, password: B.pw });
  await dev.settle();
  assert.deepEqual(ids(dev), [], 'Stand von A ist nicht unter B sichtbar');
  assert.deepEqual(cloudIds(server, B), []);
  assert.doesNotMatch(dev.render(), /a-sauber/);
});
