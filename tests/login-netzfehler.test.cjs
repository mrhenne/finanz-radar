const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness/load-app.cjs');
const { makeServer, makeClient } = require('./harness/fake-supabase.cjs');

// Backend nicht erreichbar (z. B. pausiertes Supabase-Projekt, Funkloch): jede Anmeldevariante zeigt eine verständliche Meldung, nichts bleibt unbehandelt.
const down = () => { const c = makeClient(makeServer()); const boom = async () => { throw new TypeError('Failed to fetch'); };
  Object.assign(c.auth, { signInWithPassword: boom, signUp: boom, signInWithOtp: boom, resetPasswordForEmail: boom }); return c; };

for (const fn of ['login', 'magic', 'forgot']) {
  test(`Netzfehler bei ${fn}: verständliche Meldung statt unbehandelter Ausnahme`, async () => {
    const app = loadApp({ now: '2026-11-25T10:00:00Z', tz: 'Europe/Berlin', supabase: down() });
    await app.settle(); app.render();
    app.doc.getElementById('le').value = 'x@example.test';
    app.doc.getElementById('lp').value = 'secret123';
    await app.ctx[fn](false);
    await app.settle();
    const html = app.render();
    assert.ok(html.includes('Keine Verbindung zum Server'), 'Meldung fehlt');
    assert.ok(!html.includes('Failed to fetch'));
  });
}
