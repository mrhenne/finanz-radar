'use strict';
// Fake-Supabase für Sync-Szenarien: ein gemeinsamer "Server" für mehrere Geräte (je eigener localStorage).
// Simuliert: finance_state (upsert, select), user_state (nur lesen), Auth (Anmelden, Abmelden),
// Offline (Netzfehler), Serverfehler (z. B. 413 bei zu großen Daten). Keine Verbindung ins Netz.
const MAX_BYTES = 1000000;

function makeServer(opts = {}) {
  return {
    users: {},          // email -> { id, pw }
    finance_state: {},  // user_id -> { data, updated_at }
    user_state: {},     // user_id -> { app_state, updated_at }
    offline: false,     // true: alle Anfragen werfen einen Netzfehler
    upsertError: null,  // {message, code}: Schreibfehler für alle Upserts
    selectError: null,  // {message}: Lesefehler
    maxBytes: opts.maxBytes || MAX_BYTES,
    upserts: 0,
    addUser(email, pw) { const id = 'u_' + (Object.keys(this.users).length + 1); this.users[email] = { id, pw }; return id; },
  };
}

class Builder {
  constructor(server, table) { this.server = server; this.table = table; this.filters = {}; }
  select() { return this; }
  eq(col, val) { this.filters[col] = val; return this; }
  async maybeSingle() {
    const s = this.server;
    if (s.offline) throw new TypeError('Failed to fetch');
    if (s.selectError) return { data: null, error: s.selectError };
    const uid = this.filters.user_id;
    const row = s[this.table][uid];
    if (!row) return { data: null, error: null };
    return { data: this.table === 'user_state' ? { app_state: row.app_state, updated_at: row.updated_at } : { data: JSON.parse(JSON.stringify(row.data)), updated_at: row.updated_at }, error: null };
  }
  async upsert(row) {
    const s = this.server;
    if (s.offline) throw new TypeError('Failed to fetch');
    if (s.upsertError) return { error: s.upsertError };
    const size = JSON.stringify(row.data || {}).length;
    if (size > s.maxBytes) return { error: { message: 'payload too large', code: '413' } };
    s.upserts++;
    s[this.table][row.user_id] = { data: JSON.parse(JSON.stringify(row.data)), updated_at: row.updated_at };
    return { error: null };
  }
}

function makeClient(server) {
  const state = { session: null, cb: null };
  const signIn = user => { state.session = { user: { id: user.id, email: user.email } }; if (state.cb) state.cb('SIGNED_IN', state.session); };
  return {
    server,
    auth: {
      async getSession() { return { data: { session: state.session } }; },
      onAuthStateChange(cb) { state.cb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithPassword({ email, password }) {
        const u = server.users[email];
        if (!u || u.pw !== password) return { data: null, error: { message: 'Invalid login credentials' } };
        signIn({ id: u.id, email });
        return { data: { session: state.session }, error: null };
      },
      async signUp() { return { data: { session: null }, error: null }; },
      async signOut() { state.session = null; if (state.cb) state.cb('SIGNED_OUT', null); return { error: null }; },
      async signInWithOtp() { return { error: null }; },
      async resetPasswordForEmail() { return { error: null }; },
      async updateUser() { return { error: null }; },
    },
    from(table) { return new Builder(server, table); },
  };
}

module.exports = { makeServer, makeClient };
