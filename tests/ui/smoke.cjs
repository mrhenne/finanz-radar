#!/usr/bin/env node
// Browser-Smoketest (Phase 6, Teil B): Chrome headless über CDP gegen einen lokalen Server.
// Der Server liefert das Repo aus und setzt die Header aus vercel.json (CSP, HSTS, COOP, CORP).
// Test-Kopie: config.js wird im Speicher durch einen leeren FR_CONFIG ersetzt (keine Supabase-Verbindung).
// Daten: Fixture "klein" (tests/fixtures/small.json), erfundene Werte. Kein Zugriff auf Live-Supabase.
//
// Aufruf:  node tests/ui/smoke.cjs [--chrome PFAD] [--port 9334]
// Ergebnis: je Schritt ok/Fehler, Konsolen- und Ausnahmemeldungen, CSP-Verletzungen, Netzfehler (getrennt).
// Exit 0 nur, wenn alle Schritte bestehen und keine Konsole-, Ausnahme- oder CSP-Meldung auftritt.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const arg = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const CHROME = arg('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const CDP_PORT = Number(arg('port', 9334));
const PROFILE = path.join(os.homedir(), '.cache', 'finanz-radar-smoke');
const PIN = '1234';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Server: Repo-Dateien mit den Headern aus vercel.json ----------
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const HEADERS = {};
for (const h of vercel.headers.find(r => r.source === '/(.*)').headers) HEADERS[h.key] = h.value;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'small.json'), 'utf8'));
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const head = (type) => res.writeHead(200, Object.assign({ 'content-type': type }, HEADERS));
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (p === '/__seed') { head('text/html; charset=utf-8'); return res.end('<!doctype html><meta charset="utf-8"><title>seed</title>'); }
  if (p === '/config.js') { head('text/javascript; charset=utf-8'); return res.end("window.FR_CONFIG={url:'',key:''};"); }
  const rel = p === '/' ? '/index.html' : p;
  const file = path.join(ROOT, rel);
  const inRepo = file.startsWith(ROOT + path.sep) && !rel.split('/').some(s => s.startsWith('.'));
  if (!inRepo || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  head(MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

// ---------- Minimaler CDP-Client mit Ereignissen ----------
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0; const pend = new Map(); const handlers = {};
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) (handlers[m.method] || []).forEach(f => f(m.params));
  };
  const open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (method, f) => { (handlers[method] = handlers[method] || []).push(f); };
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
    return r.result.value;
  };
  const waitFor = async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evaluate(expr)) return true; await sleep(100); } return false; };
  return { open, send, on, evaluate, waitFor, close: () => ws.close() };
}

// Prüfungen für die Seite: CSP-Verletzungen vor jedem Skript sammeln
const CSP_LISTENER = "document.addEventListener('securitypolicyviolation',e=>{(window.__csp=window.__csp||[]).push(e.violatedDirective+' | '+e.blockedURI+' | '+e.sample)});";

function pinRecord() {
  const salt = crypto.randomBytes(16);
  const h = crypto.pbkdf2Sync(PIN, salt, 310000, 32, 'sha256').toString('hex');
  return { h, n: PIN.length, m: 5, v: 2, s: salt.toString('hex'), i: 310000, f: 0, b: 0, u: 0 };
}

async function main() {
  const srv = await new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
  const base = 'http://127.0.0.1:' + srv.address().port;
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const chrome = cp.spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank'], { stdio: 'ignore', detached: true });
  const killAll = () => { try { process.kill(-chrome.pid, 'SIGKILL'); } catch (e) { /* schon beendet */ } srv.close(); };
  const guard = setTimeout(() => { console.error('Abbruch: Gesamtzeit über 12 Minuten'); killAll(); process.exit(1); }, 12 * 60 * 1000);
  guard.unref();

  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try { const list = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json(); wsUrl = (list.find(t => t.type === 'page') || {}).webSocketDebuggerUrl; } catch (e) { /* Chrome startet noch */ }
    if (!wsUrl) await sleep(100);
  }
  if (!wsUrl) { killAll(); throw new Error('Chrome-DevTools nicht erreichbar'); }

  const c = cdp(wsUrl);
  await c.open;
  // Fehler und Meldungen je Ereignis sammeln
  const meldungen = []; // { schritt, art, text }
  let schritt = 'Start';
  c.on('Runtime.exceptionThrown', p => meldungen.push({ schritt, art: 'AUSNAHME', text: (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0] }));
  c.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') meldungen.push({ schritt, art: 'KONSOLE', text: p.args.map(x => x.value || x.description || '').join(' ').slice(0, 200) }); });
  c.on('Log.entryAdded', p => {
    const e = p.entry;
    if (e.level !== 'error') return;
    if (e.source === 'security') return; // CSP-Verletzungen zählt das Ereignis securitypolicyviolation (CSP_LISTENER)
    if (e.source === 'network') meldungen.push({ schritt, art: 'NETZ', text: (e.url || '') + ' ' + e.text.slice(0, 100) });
    else meldungen.push({ schritt, art: 'KONSOLE', text: e.text.slice(0, 200) });
  });
  c.on('Page.javascriptDialogOpening', p => {
    meldungen.push({ schritt, art: 'DIALOG', text: p.message.slice(0, 120) });
    c.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
  });
  await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Log.enable'); await c.send('Network.enable');
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: CSP_LISTENER });
  // Externe Kursdaten: leere, gültige Antworten mit CORS-Kopf. Der Verbindungsversuch selbst ist durch connect-src erlaubt
  // (die CSP wird vor der Anfrage geprüft). Ohne diese Schicht blockt CoinGecko aus diesem Netz mit 429 ohne CORS-Kopf.
  await c.send('Fetch.enable', { patterns: [{ urlPattern: 'https://api.coingecko.com/*', requestStage: 'Request' }] });
  c.on('Fetch.requestPaused', p => {
    const u = p.request.url;
    const body = u.includes('market_chart') ? '{"prices":[]}' : u.includes('simple/price') ? '{}' : u.includes('/search') ? '{"coins":[]}' : '[]';
    c.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(body).toString('base64') }).catch(() => {});
  });
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const ergebnisse = [];
  const cspAntwort = (await fetch(base + '/index.html')).headers.get('content-security-policy');
  async function load(data, pinJson) {
    await navigate(base + '/__seed');
    const seed = JSON.stringify(Object.assign({}, data, { th: 'light', thv: 2 }));
    await c.evaluate(`(() => { localStorage.clear(); localStorage.setItem('fr_s', ${JSON.stringify(seed)}); ${pinJson ? `localStorage.setItem('fr_pin', ${JSON.stringify(pinJson)});` : ''} return true; })()`);
    await navigate(base + '/index.html');
    await c.waitFor("document.querySelectorAll('#v > *').length > 0");
    await sleep(300);
  }
  async function navigate(url) {
    const loaded = new Promise(r => c.on('Page.loadEventFired', r));
    await c.send('Page.navigate', { url });
    await Promise.race([loaded, sleep(15000)]);
  }
  async function schritt_(name, fn) {
    schritt = name;
    const vorher = meldungen.length;
    let ok = false, detail = '';
    try { const r = await fn(); ok = r.ok !== false; detail = r.detail || ''; }
    catch (e) { ok = false; detail = 'Ausnahme: ' + e.message; }
    const csp = await c.evaluate('(window.__csp || []).splice(0)').catch(() => []);
    for (const x of csp) meldungen.push({ schritt: name, art: 'CSP', text: x });
    const neu = meldungen.slice(vorher).filter(m => ['AUSNAHME', 'KONSOLE', 'CSP'].includes(m.art));
    const netz = meldungen.slice(vorher).filter(m => m.art === 'NETZ');
    const dialog = meldungen.slice(vorher).filter(m => m.art === 'DIALOG').map(m => m.text);
    ergebnisse.push({ name, ok: ok && neu.length === 0, detail, fehler: neu, netz: netz.length, dialog });
    console.log((ok && neu.length === 0 ? 'OK   ' : 'FEHL ') + name + (detail ? ' · ' + detail : '') + (dialog.length ? ' · Dialog: ' + dialog.join(' | ') : '') + (neu.length ? ' · ' + neu.map(m => m.art + ' ' + m.text).join(' ; ') : ''));
  }
  const klick = sel => c.evaluate(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return false; b.click(); return true; })()`);
  const tabKlick = key => c.evaluate(`(() => { const b = [...document.querySelectorAll('#tb [role=tab]')].find(x => x.getAttribute('data-args') === ${JSON.stringify(JSON.stringify([key]))}); if (!b) return false; b.click(); return true; })()`);
  // Löschen-Schaltfläche der Zeile mit dieser ID (data-args enthält die ID als JSON-Text)
  const loescheVon = id => c.evaluate(`(() => { const id = ${JSON.stringify(id)}; const b = [...document.querySelectorAll('[data-click="del"]')].find(x => (x.getAttribute('data-args') || '').includes(id)); if (!b) return false; b.click(); return true; })()`);
  const sb = async (sel, ms) => c.waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, ms);

  // 1. Start mit Fixture klein
  await schritt_('Start mit Fixture „klein“', async () => {
    await load(FIXTURE);
    const v = await c.evaluate("document.querySelectorAll('#v > *').length");
    const ttl = await c.evaluate("document.getElementById('ttl').textContent");
    return { ok: v > 0 && ttl === 'Home', detail: 'Ansicht ' + v + ' Blöcke, Titel „' + ttl + '“' };
  });

  // 2. Alle Tabs öffnen
  for (const key of ['home', 'cash', 'assets', 'fire', 'plan', 'more']) {
    await schritt_('Tab ' + key, async () => {
      const da = await tabKlick(key);
      await sleep(250);
      const t = await c.evaluate('tab');
      const ttl = await c.evaluate("document.getElementById('ttl').textContent");
      const soll = await c.evaluate(`TT[${JSON.stringify(key)}]`);
      return { ok: da && t === key && ttl === soll, detail: 'Titel „' + ttl + '“' };
    });
  }

  // 3. Panel-Köpfe auf- und zuklappen
  await schritt_('Panel-Kopf zuklappen und öffnen', async () => {
    await tabKlick('home'); await sleep(200);
    const pk = await c.evaluate("document.querySelector('.panel[data-pk] h2 span[data-click]').closest('.panel').dataset.pk");
    await klick('.panel[data-pk] h2 span[data-click]'); await sleep(200);
    const zu = await c.evaluate(`!!S.ui.c[${JSON.stringify(pk)}]`);
    await klick('.panel[data-pk] h2 span[data-click]'); await sleep(200);
    const auf = await c.evaluate(`!S.ui.c[${JSON.stringify(pk)}]`);
    return { ok: zu && auf, detail: 'Schlüssel ' + pk };
  });

  // 4. Design: hell, dunkel, automatisch, zurück zu hell
  await schritt_('Design-Umschalter (hell, dunkel, automatisch)', async () => {
    const seq = [];
    for (let i = 0; i < 3; i++) { await klick('#th'); await sleep(150); seq.push(await c.evaluate('S.th')); }
    const attr = await c.evaluate("document.documentElement.dataset.theme || 'auto'");
    return { ok: seq.join(',') === 'dark,auto,light' && attr === 'light', detail: 'Folge ' + seq.join(' → ') };
  });

  // 5. Zahlen ausblenden
  await schritt_('Zahlen ausblenden und einblenden', async () => {
    await klick('button[aria-label^="Zahlen ausblenden"]'); await sleep(150);
    const an = await c.evaluate("S.hide === true && document.body.classList.contains('hide')");
    await klick('button[aria-label^="Zahlen ausblenden"]'); await sleep(150);
    const aus = await c.evaluate("S.hide === false && !document.body.classList.contains('hide')");
    return { ok: an && aus };
  });

  // 6. Monatsnavigation
  await schritt_('Monatsnavigation vor und zurück', async () => {
    await tabKlick('cash'); await sleep(200);
    const m0 = await c.evaluate('mo');
    await klick('button[aria-label="Vormonat"]'); await sleep(150);
    const m1 = await c.evaluate('mo');
    await klick('button[aria-label="Folgemonat"]'); await sleep(150);
    const m2 = await c.evaluate('mo');
    return { ok: m1 !== m0 && m2 === m0, detail: m0 + ' → ' + m1 + ' → ' + m2 };
  });

  // 7. Buchung über die Schnellerfassung anlegen
  let buchungsId = null;
  await schritt_('Buchung über Schnellerfassung anlegen', async () => {
    await tabKlick('home'); await sleep(150);
    await klick('#qfab');
    const offen = await sb('#qsh', 4000);
    await c.evaluate(`(() => { document.getElementById('q_a').value = '12.34'; document.getElementById('q_n').value = 'Smoke-Test'; return true; })()`);
    await klick('#qsh [data-click="qSave"]'); await sleep(300);
    buchungsId = await c.evaluate("(() => { const x = S.tx.find(t => t.n === 'Smoke-Test'); return x ? x.id : null; })()");
    return { ok: offen && !!buchungsId, detail: 'Buchung ' + buchungsId };
  });

  // 8. Buchung wieder löschen
  await schritt_('Buchung löschen', async () => {
    await tabKlick('cash'); await sleep(250);
    const da = await loescheVon(buchungsId);
    await sleep(200);
    const weg = await c.evaluate(`!S.tx.some(t => t.id === ${JSON.stringify(buchungsId)})`);
    return { ok: da && weg };
  });

  // 9. Backup: Export, dann Import öffnen (Bestätigung wird abgelehnt)
  await schritt_('Backup-Export und Import-Dialog', async () => {
    await tabKlick('more'); await sleep(150);
    await c.evaluate(`(() => { const b = [...document.querySelectorAll('[data-click="goTab"]')].find(x => x.getAttribute('data-args') === '["data"]'); if (b) b.click(); return !!b; })()`);
    await sleep(250);
    const tabOk = await c.evaluate("tab === 'data'");
    await klick('[data-click="exportBackup"]'); await sleep(200);
    const json = await c.evaluate("(() => { try { return Object.keys(JSON.parse(document.getElementById('bk').value)).length > 3; } catch (e) { return false; } })()");
    const vorher = await c.evaluate('S.tx.length');
    await klick('[data-click="importBackup"]'); await sleep(400);
    const nachher = await c.evaluate('S.tx.length');
    return { ok: tabOk && json && vorher === nachher, detail: 'Buchungen ' + vorher + ' → ' + nachher };
  });

  // 10. PIN-Sperre öffnen und mit der PIN schließen
  await schritt_('PIN-Sperre öffnen und schließen', async () => {
    await load(FIXTURE, JSON.stringify(pinRecord()));
    await tabKlick('more'); await sleep(150);
    await c.evaluate(`(() => { const b = [...document.querySelectorAll('[data-click="goTab"]')].find(x => x.getAttribute('data-args') === '["sec"]'); if (b) b.click(); return !!b; })()`);
    await sleep(250);
    await klick('[data-click="lockNow"]');
    const offen = await sb('#lk', 4000);
    for (const d of PIN) { await c.evaluate(`(() => { const b = [...document.querySelectorAll('#lk [data-click="pinKey"]')].find(x => x.getAttribute('data-args') === ${JSON.stringify(JSON.stringify([d]))}); if (b) b.click(); return !!b; })()`); await sleep(120); }
    const zu = await c.waitFor("!document.getElementById('lk')", 10000);
    return { ok: offen && zu, detail: 'Sperre ' + (offen ? 'offen' : 'nicht sichtbar') + ', danach ' + (zu ? 'entsperrt' : 'noch gesperrt') };
  });

  // 11. Prognose-Chips (Teilfreistellung)
  await schritt_('Prognose-Chips klicken', async () => {
    await load(FIXTURE);
    await tabKlick('plan'); await sleep(250);
    const chip = async wert => c.evaluate(`(() => { const b = [...document.querySelectorAll('#pr_tf .chip')].find(x => x.textContent.includes(${JSON.stringify(wert + ' %')})); if (!b) return false; b.click(); return true; })()`);
    const ok1 = await chip(15); await sleep(250);
    const a = await c.evaluate('S.f.tf');
    const an = await c.evaluate("[...document.querySelectorAll('#pr_tf .chip')].some(x => x.textContent.includes('15 %') && x.classList.contains('on'))");
    const ok2 = await chip(30); await sleep(250);
    const b = await c.evaluate('S.f.tf');
    return { ok: ok1 && ok2 && a === 15 && an && b === 30, detail: 'Teilfreistellung 15 → ' + a + ' (Chip an: ' + an + '), zurück 30 → ' + b };
  });

  // 12. Schuld anlegen und wieder löschen
  await schritt_('Schulden anlegen und löschen', async () => {
    let da = false;
    for (const key of ['assets', 'cash', 'home']) {
      await tabKlick(key); await sleep(200);
      if (await c.evaluate("!!document.getElementById('dn')")) { da = true; break; }
    }
    if (!da) return { ok: false, detail: 'Schuldenformular nicht gefunden' };
    await c.evaluate("(() => { document.getElementById('dn').value = 'Smoke-Schuld'; document.getElementById('da').value = '5000'; return true; })()");
    await klick('[data-click="addDebt"]'); await sleep(250);
    const id = await c.evaluate("(() => { const x = S.debts.find(d => d.n === 'Smoke-Schuld'); return x ? x.id : null; })()");
    const angelegt = !!id;
    await loescheVon(id); await sleep(250);
    const weg = await c.evaluate(`!S.debts.some(d => d.id === ${JSON.stringify(id)})`);
    return { ok: angelegt && weg, detail: 'Schuld ' + (id || '–') };
  });

  // 13. Schnellerfassung mit Esc schließen
  await schritt_('Schnellerfassung mit Esc schließen', async () => {
    await tabKlick('home'); await sleep(150);
    await klick('#qfab');
    const offen = await sb('#qsh.on', 4000);
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    const zu = await c.waitFor("!document.querySelector('#qsh.on')", 4000);
    return { ok: offen && zu };
  });

  // Zusammenfassung
  const fehlerGesamt = ergebnisse.reduce((n, r) => n + r.fehler.length, 0);
  const netzGesamt = ergebnisse.reduce((n, r) => n + r.netz, 0);
  const cspGesamt = ergebnisse.reduce((n, r) => n + r.fehler.filter(f => f.art === 'CSP').length, 0);
  const alleOk = ergebnisse.every(r => r.ok);
  console.log('---');
  console.log('Schritte: ' + ergebnisse.length + ', davon ok: ' + ergebnisse.filter(r => r.ok).length);
  console.log('Konsole/Ausnahmen: ' + (fehlerGesamt - cspGesamt) + ', CSP-Verletzungen: ' + cspGesamt + ', Netzmeldungen (getrennt): ' + netzGesamt);
  for (const m of meldungen.filter(m => m.art === 'NETZ')) console.log('  NETZ ' + m.schritt + ': ' + m.text);
  console.log('CSP der Antwort: ' + cspAntwort);
  await c.send('Browser.close').catch(() => {});
  c.close();
  killAll();
  await sleep(300);
  process.exit(alleOk && fehlerGesamt === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
