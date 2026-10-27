#!/usr/bin/env node
// UI-Matrix für Phase 4: Screenshots aller Tabs und Sheets × Hell/Dunkel × Breiten × Fixtures
// plus DOM-Audit (horizontales Scrollen, Touch-Ziele unter 44 px, Konsolenfehler).
// Nur Node-Bordmittel (Node 22+ mit globalem WebSocket), kein npm, kein Build-Schritt.
//
// Aufruf:  node tests/ui/shoot.cjs [--out DIR] [--profile DIR] [--only klein] [--chrome PFAD]
//   --out      Zielordner (Standard: bericht/screens im Repo)
//   --profile  Chrome-Profil, wird bei jedem Lauf neu angelegt (Standard: ~/.cache/finanz-radar-shots)
//   --only     nur eine Fixture: leer | klein | extrem
//
// Der Server liefert das Repo unverändert aus, außer config.js: lokal ohne Supabase-URL
// (Login-Ansicht entfällt) bzw. für die Login-Ansicht eine Dummy-URL ohne Netz.
// Fixtures kommen aus tests/fixtures (erfundene Werte). Kein Zugriff auf Live-Supabase.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const arg = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const OUT = path.resolve(arg('out', path.join(ROOT, 'bericht', 'screens')));
const PROFILE = path.resolve(arg('profile', path.join(os.homedir(), '.cache', 'finanz-radar-shots')));
const ONLY = arg('only', null);
const CHROME = arg('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const CDP_PORT = 9333;
// Filter für die reduzierte Matrix: --widths 375,430 --themes light --views home,plan --sheets none
const WIDTHS = arg('widths', '375,390,430,768,1280').split(',').map(Number);
const THEMES = arg('themes', 'light,dark').split(',');
const VIEW_FILTER = arg('views', null);
const PIN = '1234';

// Ansichten: [Name, Tab-Schlüssel]. Tab-Schlüssel gemäß onclick der Tab-Leiste.
const VIEWS = [['home', 'home'], ['cash', 'cash'], ['vermoegen', 'assets'], ['fuckoff', 'fire'], ['prognose', 'plan'], ['mehr', 'more']].filter(v => !VIEW_FILTER || VIEW_FILTER.split(',').includes(v[0]));
// Sheets/Dialoge: Schnellerfassung (FAB), CSV-Import, PIN-Sperre, Login
const SHEETS = arg('sheets', 'schnellerfassung,csv-import,pin,login').split(',').filter(x => x && x !== 'none');

const FIXTURES = {
  leer: () => fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'empty.json'), 'utf8'),
  klein: () => fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'small.json'), 'utf8'),
  extrem: () => cp.execFileSync(process.execPath, [path.join(ROOT, 'tests', 'fixtures', 'extreme.cjs')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- statischer Server (nur Repo-Dateien, keine Dotfiles) ----------
let cfgMode = 'local';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.cjs': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__seed') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<!doctype html><meta charset="utf-8"><title>seed</title>'); }
  if (p === '/config.js') {
    const body = cfgMode === 'login'
      ? "window.FR_CONFIG={url:'http://127.0.0.1:9',key:'dummy-key'};"
      : "window.FR_CONFIG={url:'',key:''};";
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); return res.end(body);
  }
  const rel = p === '/' ? '/index.html' : p;
  const file = path.join(ROOT, rel);
  const inRepo = file.startsWith(ROOT + path.sep) && !rel.split('/').some(s => s.startsWith('.'));
  if (!inRepo || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

// ---------- minimaler CDP-Client ----------
function cdpConnect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0; const pending = new Map(); const waiters = []; const events = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method) {
      events.push(m);
      for (const w of waiters.filter(w => w.method === m.method)) { waiters.splice(waiters.indexOf(w), 1); w.res(m.params); }
    }
  };
  const open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = (method, ms = 15000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Timeout: ' + method)), ms);
    waiters.push({ method, res: v => { clearTimeout(t); res(v); } });
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  return { open, send, once, evaluate, events, close: () => ws.close() };
}

async function shutdown(c, chrome, srv) {
  try { await c.send('Browser.close'); } catch (e) { /* schon beendet */ }
  c.close();
  // Prozessgruppe beenden: Chrome-Hilfsprozesse bleiben sonst als Waisen zurück
  try { process.kill(-chrome.pid, 'SIGKILL'); } catch (e) { /* schon beendet */ }
  srv.close();
  await sleep(500);
}

async function navigate(c, url) {
  const loaded = c.once('Page.loadEventFired');
  await c.send('Page.navigate', { url });
  await loaded;
}

function pinRecord() {
  const salt = crypto.randomBytes(16);
  const h = crypto.pbkdf2Sync(PIN, salt, 310000, 32, 'sha256').toString('hex');
  return { h, n: PIN.length, m: 5, v: 2, s: salt.toString('hex'), i: 310000, f: 0, b: 0, u: 0 };
}

// DOM-Audit: horizontaler Überlauf, Ziele unter 44 px (sichtbare, interaktive Elemente)
const AUDIT_JS = `(() => {
  const de = document.documentElement;
  const small = [];
  document.querySelectorAll('button,a,input,select,textarea,[onclick],[role=tab]').forEach(el => {
    if (el.closest('[aria-hidden=true]')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.width < 44 || r.height < 44) {
      const name = (el.tagName + (el.id ? '#' + el.id : '') + ' "' + (el.textContent || el.value || el.placeholder || '').trim().slice(0, 18) + '"');
      small.push(name + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
  });
  return { overflow: de.scrollWidth - de.clientWidth, small: small.length, examples: [...new Set(small)].slice(0, 6) };
})()`;

// Einzelprüfung ohne Matrix: --probe 'JS' --tab prognose --w 375 --fx klein --theme light
async function probe(c, base, expr, tab, w, fx, theme) {
  const data = Object.assign({}, JSON.parse(FIXTURES[fx]()), { th: theme, thv: 2 });
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: 844, deviceScaleFactor: 1, mobile: w < 700 });
  await navigate(c, base + '/__seed');
  await c.evaluate(`(() => { localStorage.clear(); localStorage.setItem('fr_s', ${JSON.stringify(JSON.stringify(data))}); return true; })()`);
  await navigate(c, base + '/index.html');
  await sleep(400);
  if (tab) await c.evaluate(`(() => { tab = '${tab}'; render(); return true; })()`);
  await sleep(300);
  return c.evaluate(expr);
}

async function main() {
  const fixtureNames = Object.keys(FIXTURES).filter(f => !ONLY || f === ONLY);
  const PROBE = arg('probe', null);
  if (!PROBE) { fs.mkdirSync(OUT, { recursive: true }); }
  fs.rmSync(PROFILE, { recursive: true, force: true });

  const srv = await new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
  const base = 'http://127.0.0.1:' + srv.address().port;

  const chrome = cp.spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore', detached: true });

  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try { const list = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json(); wsUrl = (list.find(t => t.type === 'page') || {}).webSocketDebuggerUrl; } catch (e) { /* Chrome startet noch */ }
    if (!wsUrl) await sleep(100);
  }
  if (!wsUrl) throw new Error('Chrome-DevTools nicht erreichbar');

  const c = cdpConnect(wsUrl);
  await c.open;
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Network.enable');
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });

  if (PROBE) {
    const out = await probe(c, base, PROBE, arg('tab', null), Number(arg('w', 390)), arg('fx', 'klein'), arg('theme', 'light'));
    console.log(JSON.stringify(out, null, 1));
    await shutdown(c, chrome, srv);
    return;
  }

  const audit = [];
  const konsole = [];
  let count = 0;

  for (const fx of fixtureNames) {
    const base0 = JSON.parse(FIXTURES[fx]());
    for (const theme of THEMES) {
      for (const w of WIDTHS) {
        const h = w < 700 ? 844 : 900;
        const mobile = w < 700;
        await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
        await c.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        for (const [name, key] of [...VIEWS.map(v => [v[0], v[1], 'tab']), ...SHEETS.map(s => [s, null, 'sheet'])]) {
          const isLogin = name === 'login';
          const isPin = name === 'pin';
          const label = name + '__' + theme + '__' + w + '__' + fx;
          const data = Object.assign({}, base0, { th: theme, thv: 2 });
          const seed = JSON.stringify(data);
          cfgMode = isLogin ? 'login' : 'local';

          await navigate(c, base + '/__seed');
          const pinJson = isPin ? JSON.stringify(pinRecord()) : null;
          await c.evaluate(`(() => { localStorage.clear(); localStorage.setItem('fr_s', ${JSON.stringify(seed)}); ${pinJson ? `localStorage.setItem('fr_pin', ${JSON.stringify(pinJson)});` : ''} return true; })()`);

          const errStart = c.events.length;
          await navigate(c, base + '/index.html');
          await sleep(500);

          if (key) await c.evaluate(`(() => { tab = '${key}'; render(); scrollTo(0, 0); return true; })()`);
          if (name === 'schnellerfassung') await c.evaluate(`(() => { const b = document.querySelector('.qfab'); if (b) b.click(); return !!b; })()`);
          if (name === 'csv-import') await c.evaluate(`(() => { tab = 'csv'; render(); scrollTo(0, 0); return true; })()`);
          await sleep(400);

          const shotName = label + '.png';
          const shot = await c.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(OUT, shotName), Buffer.from(shot.data, 'base64'));

          const a = await c.evaluate(AUDIT_JS);
          audit.push(Object.assign({ shot: shotName }, a));

          for (const ev of c.events.slice(errStart)) {
            if (ev.method === 'Runtime.exceptionThrown') konsole.push(label + ' EXCEPTION ' + (ev.params.exceptionDetails.exception?.description || ev.params.exceptionDetails.text).split('\n')[0]);
            if (ev.method === 'Runtime.consoleAPICalled' && ev.params.type === 'error') konsole.push(label + ' CONSOLE ' + ev.params.args.map(x => x.value || x.description || '').join(' ').slice(0, 200));
            if (ev.method === 'Log.entryAdded' && ev.params.entry.level === 'error') konsole.push(label + ' LOG ' + ev.params.entry.text.slice(0, 200));
          }
          c.events.length = 0;
          count++;
        }
      }
    }
  }

  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(audit, null, 1));
  fs.writeFileSync(path.join(OUT, 'konsole.txt'), konsole.length ? konsole.join('\n') + '\n' : 'keine Fehler\n');
  await shutdown(c, chrome, srv);
  console.log('Screenshots: ' + count + ' → ' + OUT);
  console.log('Konsolenmeldungen: ' + konsole.length);
}

main().catch(e => { console.error(e); process.exit(1); });
