const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./harness/load-app.cjs');

// B-19: Alte Schulden ohne Zins- und Rate-Felder bleiben unverändert (Ansicht, Nettovermögen).
// Der Snapshot wurde auf dem Stand vor B-19 erzeugt. Der Eingabeblock der Schulden wird ausgeblendet,
// weil er sich bewusst ändert (neue Felder). Die Anzeige der Schuldenliste muss gleich bleiben.
const small = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'small.json'), 'utf8'));
const SNAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'snapshots', 'schulden-alt.json'), 'utf8'));
const ohneForm = h => h.replace(/<div class="row" style="margin-top:8px"><input aria-label="Bezeichnung der Schuld"[\s\S]*?Schuld hinzufügen<\/button>/, '[FORM]');

test('alte Schulden ohne Felder: Ansicht Vermögen unverändert (Snapshot)', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: small });
  app.h.setTab('assets');
  assert.equal(ohneForm(app.render()), SNAP.view);
});

test('alte Schulden ohne Felder: Nettovermögen, Schulden und Assets unverändert', () => {
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: small });
  assert.equal(app.evalApp('nn()'), SNAP.nn);
  assert.equal(app.evalApp('dt()'), SNAP.dt);
  assert.equal(app.evalApp('nw()'), SNAP.nw);
});

test('Schulden mit Zins und Rate: Nettovermögen bleibt Assets minus Schulden', () => {
  const f = JSON.parse(JSON.stringify(small));
  f.debts = [{ id: 'd1', n: 'Fixture Kredit', a: 10000, r: 5, rate: 300 }, { id: 'd2', n: 'Fixture Dispo', a: 500 }];
  const app = loadApp({ now: '2026-10-26T10:00:00Z', tz: 'Europe/Berlin', fixture: f });
  assert.equal(app.evalApp('dt()'), 10500);
  assert.equal(app.evalApp('nn()'), SNAP.nw - 10500);
});
