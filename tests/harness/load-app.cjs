'use strict';
// Lädt die echte App (config.js, app.js, features.js, extras.js, boost.js) in einen vm-Kontext
// mit DOM-, Storage-, Timer-, Fetch- und Datums-Stubs. Der Produktivcode wird unverändert gelesen.
// Nur Test-Hilfsfunktionen; keine Änderungen an den App-Dateien.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const readRoot = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SCRIPTS = ['config.js', 'app.js', 'features.js', 'extras.js', 'boost.js'];

function unescapeAttr(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

class Storage {
  constructor(seed = {}) { this.m = new Map(Object.entries(seed)); this.failSet = false; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.failSet) throw new Error('QuotaExceeded'); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
}

class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, force) { const on = force === undefined ? !this.set.has(c) : !!force; on ? this.set.add(c) : this.set.delete(c); return on; }
  contains(c) { return this.set.has(c); }
}

class StubEl {
  constructor(doc, tagName = 'div') {
    this._doc = doc; this.tagName = String(tagName).toUpperCase(); this._id = ''; this._html = ''; this._kids = [];
    this.attrs = {}; this.value = ''; this.checked = false; this.textContent = ''; this.dataset = {};
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.children = []; this.parentNode = null; this.listeners = {}; this.className = ''; this.classList = new ClassList(this);
  }
  get id() { return this._id; }
  set id(v) { this._id = String(v); if (this._id) this._doc.reg.set(this._id, this); }
  get innerHTML() { return this._html; }
  set innerHTML(h) {
    this._unregKids();
    this._html = String(h);
    const re = /<([a-zA-Z][\w-]*)((?:\s[^>]*)?)>/g;
    let m;
    while ((m = re.exec(this._html))) {
      const attrs = m[2] || '';
      const idm = attrs.match(/\sid="([^"]*)"/);
      if (!idm || !idm[1]) continue;
      const el = new StubEl(this._doc, m[1]);
      el.id = unescapeAttr(idm[1]);
      const vm_ = attrs.match(/\svalue="([^"]*)"/);
      if (vm_) el.value = unescapeAttr(vm_[1]);
      el.checked = /\schecked(\s|$)/.test(attrs);
      el.parentNode = this;
      this._kids.push(el);
    }
  }
  _unregKids() {
    this._kids.forEach(k => { if (this._doc.reg.get(k._id) === k) this._doc.reg.delete(k._id); });
    this._kids = [];
  }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c) { c.parentNode = this; this.children.push(c); return c; }
  remove() {
    if (this._id && this._doc.reg.get(this._id) === this) this._doc.reg.delete(this._id);
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this);
  }
  after() {}
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener() {}
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  focus() { this._doc.activeElement = this; }
  click() {}
  blur() {}
  select() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  get isConnected() { return true; }
}

function makeDocument() {
  const doc = {
    reg: new Map(), hidden: false, readyState: 'complete', listeners: {},
    getElementById(id) { return this.reg.get(id) || null; },
    createElement(t) { return new StubEl(doc, t); },
    createElementNS(ns, t) { return new StubEl(doc, t); },
    createTextNode(t) { return { nodeValue: t }; },
    createDocumentFragment() { return new StubEl(doc, 'fragment'); },
    createTreeWalker() { return { currentNode: null, nextNode() { return false; } }; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    removeEventListener() {},
  };
  doc.body = new StubEl(doc, 'body');
  doc.head = new StubEl(doc, 'head');
  doc.documentElement = new StubEl(doc, 'html');
  doc.activeElement = new StubEl(doc, 'body');
  return doc;
}

/* Statisches DOM aus index.html: alle ids anlegen, damit $('v') usw. existieren. */
function registerStaticDom(doc) {
  const html = readRoot('index.html');
  const re = /<([a-zA-Z][\w-]*)((?:\s[^>]*)?)>/g;
  let m;
  while ((m = re.exec(html))) {
    const idm = m[2].match(/\sid="([^"]*)"/);
    if (!idm) continue;
    const el = new StubEl(doc, m[1]);
    el.id = idm[1];
    const vm_ = m[2].match(/\svalue="([^"]*)"/);
    if (vm_) el.value = unescapeAttr(vm_[1]);
  }
}

/**
 * loadApp(opts)
 *  opts.now        ISO-Zeitpunkt für new Date() und Date.now() (fest, mit api.setNow änderbar)
 *  opts.tz         Zeitzone des Prozesses, z. B. 'Europe/Berlin' (Node setzt sie zur Laufzeit)
 *  opts.fixture    Objekt, das als fr_s im localStorage liegt (wie beim Start der App)
 *  opts.storage    weitere localStorage-Einträge (Schlüssel -> String)
 *  opts.supabase   Fake-Client für window.supabase.createClient (nur mit Konfiguration aktiv)
 *  opts.fetch      async (url, init, n) => Response-ähnliches Objekt; ohne Angabe: Netz aus
 *  opts.confirm    Rückgabe für confirm() (Standard true)
 */
function loadApp(opts = {}) {
  if (opts.tz) process.env.TZ = opts.tz;
  const RealDate = Date;
  let nowMs = opts.now ? RealDate.parse(opts.now) : null;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(nowMs ?? RealDate.now()); else super(...a); }
    static now() { return nowMs ?? RealDate.now(); }
  }
  const doc = makeDocument();
  registerStaticDom(doc);
  const timers = [];
  let timerId = 0;
  const calls = [], alerts = [], confirms = [], logs = { error: [], warn: [], log: [] };
  const storage = new Storage(Object.assign({}, opts.storage || {}, opts.fixture ? { fr_s: JSON.stringify(opts.fixture) } : {}));
  const mm = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const sandbox = {
    console: { log: (...a) => logs.log.push(a), warn: (...a) => logs.warn.push(a), error: (...a) => logs.error.push(a), info() {}, debug() {} },
    Date: FakeDate, Intl, TextEncoder, TextDecoder, crypto: globalThis.crypto, performance: globalThis.performance,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    Blob: class { constructor(parts) { this.parts = parts; } },
    NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
    document: doc, localStorage: storage,
    alert: m => { alerts.push(String(m)); }, confirm: () => { confirms.push(true); return opts.confirm === undefined ? true : opts.confirm; },
    prompt: () => null, scrollTo() {},
    matchMedia: mm, navigator: { onLine: true },
    location: { protocol: 'https:', hostname: 'app.test', origin: 'https://app.test', pathname: '/', href: 'https://app.test/' },
    setTimeout: (fn, ms, ...args) => { const id = ++timerId; timers.push({ id, fn, args, ms }); return id; },
    clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      if (opts.fetch) return opts.fetch(String(url), init, calls.length);
      throw new TypeError('fetch failed (offline)');
    },
    addEventListener() {}, removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  if (opts.supabase) sandbox.supabase = { createClient: () => opts.supabase };
  const ctx = vm.createContext(sandbox);
  SCRIPTS.forEach(f => vm.runInContext(readRoot(f), ctx, { filename: f }));

  // Zugriff auf lokale Zustände (let/const der App) nur für Tests. Keine Änderung am Produktivcode.
  vm.runInContext(`globalThis.__h = {
    S: () => S, setS: v => { S = v; }, tab: () => tab, setTab: v => { tab = v; }, mo: () => mo, setMo: v => { mo = v; },
    V: () => V, trd: () => trd, setTrd: v => { trd = v; }, ed: () => ed, setEd: v => { ed = v; },
    LIVE: () => LIVE, setLIVE: v => { LIVE = v; }, CH: () => CH, CGQ: () => CGQ, setLrg: v => { lrg = v; },
    sync: () => ({ syncMsg, syncOk, legacyPending, legacyCheckError, user }), setUser: v => { user = v; },
    getUser: () => user, setSyncOk: v => { syncOk = v; }, TABS: () => TABS, SUB: () => SUB,
  };`, ctx);

  const api = {
    ctx, doc, calls, alerts, confirms, logs, storage,
    h: ctx.__h,
    /** Setzt die Uhr auf einen anderen Zeitpunkt (ISO-String). */
    setNow(iso) { nowMs = RealDate.parse(iso); },
    el: id => doc.getElementById(id),
    /** Wertet einen Ausdruck im Kontext der App aus, auch für Top-Level-Namen wie eur() oder esc(). */
    evalApp: expr => vm.runInContext(expr, ctx),
    /** Führt alle ausstehenden Timer aus (debounce, Wiederholungen). */
    runTimers() { const list = timers.splice(0); list.forEach(t => t.fn(...t.args)); return list.length; },
    pendingTimers: () => timers.length,
    /** Lässt Promises und Timer so lange laufen, bis nichts mehr ansteht. */
    async settle(rounds = 20) {
      for (let i = 0; i < rounds; i++) {
        await new Promise(r => setImmediate(r));
        if (!timers.length) continue;
        api.runTimers();
      }
    },
    /** Gerenderte Ansicht des aktuellen Tabs als HTML-String. */
    view() { return doc.getElementById('v').innerHTML; },
    /** Rendert neu (wie die App) und gibt den HTML-Text der Ansicht zurück. */
    render() { ctx.render(); return doc.getElementById('v').innerHTML; },
    /** Ruft eine Ansicht direkt auf (V[name]) und gibt den HTML-Text zurück. */
    viewOf(name) { return ctx.__h.V()[name](); },
    logsOfErrors: () => logs.error.map(a => a.map(String).join(' ')),
  };
  return api;
}

module.exports = { loadApp, StubEl, makeDocument };
