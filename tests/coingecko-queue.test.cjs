const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const src = fs.readFileSync('app.js', 'utf8');
const code = src.slice(src.indexOf("const RG=[['4h'"), src.indexOf('const fl=(ts,l)=>'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function harness() {
  const calls = [], store = {};
  const api = new Function('calls', 'store', `let tab='crypto',mode='429';const document={activeElement:{tagName:'DIV'}};
const localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}};function render(){}
async function fetch(u){calls.push(u);if(mode==='429')return{status:429,ok:false,headers:{get:()=>'1'}};
return{status:200,ok:true,headers:{get:()=>null},json:async()=>({prices:[[Date.now()-1e5,1],[Date.now(),2]]})}}
${code};return{series,CGQ,setMode:m=>{mode=m},setR:r=>{lrg=r}};`)(calls, store);
  return { api, calls, store };
}

test('rate limit pauses the queue and recovers automatically', async () => {
  const { api, calls, store } = harness();
  ['bitcoin', 'ethereum', 'solana'].forEach(id => api.series(id));
  await sleep(50);
  assert.equal(calls.length, 1, 'only one request before the pause');
  assert.equal(api.series('bitcoin'), 'err');
  api.setMode('ok');
  await sleep(4500);
  ['bitcoin', 'ethereum', 'solana'].forEach(id => assert.ok(Array.isArray(api.series(id)), id));
  assert.ok(store.fr_cg, 'history cached for app restarts');
  clearTimeout(api.CGQ.tm);
});

test('fresh data is not refetched and YTD shares the 1J request', async () => {
  const { api, calls } = harness();
  api.setMode('ok');
  api.setR('1J'); api.series('bitcoin'); await sleep(50);
  const n = calls.length;
  api.series('bitcoin'); api.setR('YTD'); api.series('bitcoin'); await sleep(50);
  assert.equal(calls.length, n);
  clearTimeout(api.CGQ.tm);
});
