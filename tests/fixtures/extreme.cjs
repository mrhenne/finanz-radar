// Extremdatensatz für Messungen: 5.000 Buchungen über 12 Jahre, 20 Krypto-Positionen, 144 Historienpunkte.
// Alle Werte sind erfunden und deterministisch (feste Pseudozufallsfolge), keine echten Daten.
const CATS = ['Lebensmittel', 'Wohnen', 'Mobilität', 'Freizeit', 'Versicherung', 'Abos', 'Sonstiges', 'Sparen/Invest'];
function makeExtreme() {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const tx = [];
  for (let i = 0; i < 5000; i++) {
    const y = 2015 + Math.floor(i / 417), m = (i % 12) + 1, day = 1 + Math.floor(rnd() * 28);
    const d = y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    tx.push({ id: 'x' + i, d, c: CATS[i % CATS.length], a: Math.round(rnd() * 90000) / 100, n: 'Fixture ' + (i % 40), r: null });
  }
  const as = [];
  for (let k = 0; k < 20; k++) {
    const q = 0.1 + k, p = 100 + k * 37, c = Math.round(q * p * 0.8);
    as.push({ id: 'c' + k, n: 'Fixture Coin ' + k, k: 'crypto', q, p, c, l: [{ d: '2020-01-01', q, p: p * 0.8, f: 0 }] });
  }
  const hist = [];
  for (let i = 0; i < 144; i++) {
    const y = 2015 + Math.floor(i / 12), m = (i % 12) + 1;
    hist.push({ id: 'h' + i, m: y + '-' + String(m).padStart(2, '0'), nw: 1000 + i * 250 });
  }
  return { tx, as, goals: [], rec: [], debts: [], hist, sales: [], ui: { c: {}, o: {} }, th: 'light', f: { wr: 4, exp: '2500', r: 6 } };
}
module.exports = { makeExtreme };
// Direkter Aufruf gibt nur das JSON aus (tests/ui/shoot.cjs liest genau diese Ausgabe).
if (require.main === module) process.stdout.write(JSON.stringify(makeExtreme()));
