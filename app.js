/* app.js: Kern der App. Zustand S, Speichern (fr_s), Synchronisierung mit Supabase (Upload, Abruf, Sicherungen),
   Anmeldung, Ansichten V.* (Home, Cashflow, Vermögen, FIRE, Mehr …), Diagramme (SVG), Kurse (CoinGecko).
   Abhängigkeiten: config.js (window.FR_CONFIG), window.supabase (Skript mit defer, vor dieser Datei).
   Ladereihenfolge: config.js, app.js (rendert am Ende einmal), features.js, extras.js, boost.js.
   Spätere Dateien ersetzen Funktionen über window (W.render, W.theme, W.bars, W.cu). */
/* Fachliche Konstanten. Werte unverändert; Änderung nur zusammen mit den Tests. */
const SYNC_DELAY_MS = 1500, TAX_KAP_PCT = 26.375, FREIBETRAG_KAP = 1000, FREIGRENZE_SPEKU = 1000, ETF_STEUERANTEIL = 0.7, DEFAULT_WR_PCT = 4, KAP_ESt_PCT = 25, SOLI_PCT = 5.5;
const ANIM=matchMedia('(prefers-reduced-motion: reduce)').matches?'':'<animate attributeName="r" values="3;6;3" dur="1.8s" repeatCount="indefinite"/>';
const $=i=>document.getElementById(i),eur=v=>{const n=Number(v);if(!isFinite(n))return '–';return (Math.sign(n)*Math.round(Math.abs(n))||0).toLocaleString('de-DE')+' €'},pct=v=>{const n=Number(v);if(!isFinite(n))return '–';return ((Math.round(n*10)/10)||0).toLocaleString('de-DE',{maximumFractionDigits:1})+' %'},uid=()=>Math.random().toString(36).slice(2,8);
/* Kalendertage in Ortszeit. Nicht toISOString(): das liefert UTC und verschiebt Buchungen am 1. nach 00:00 Ortszeit in den Vormonat. */
const ymdOf=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),ymOf=(d=new Date())=>ymdOf(d).slice(0,7),ldate=s=>{const[y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
/* Tag im Zielmonat: 31. im Februar wird zum 28./29. (kein Datum wie 31.02.) */
/* Haltefrist (§ 23 EStG): steuerfrei nur, wenn der Verkauf mehr als ein Jahr nach dem Kauf liegt. Kalendertage, keine 365,25-Tage-Näherung. */
const heldMore1Y=(d,ref)=>{const[y,m,dd]=String(d).slice(0,10).split('-').map(Number);return ldate(ref||ymdOf())>new Date(y+1,m-1,dd)};
const clampDay=(ym,dd)=>{const[y,m]=ym.split('-').map(Number),last=new Date(y,m,0).getDate();return String(Math.min(+dd,last)).padStart(2,'0')};
const esc=s=>String(s||'').replace(/[&<>"'\x60]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','\x60':'&#96;'})[ch]);
const clean=s=>String(s||'').replace(/[<>&"]/g,'');
const IN=['Gehalt','Nebenjob','Sonstige Einnahmen'],OUT=['Wohnen','Lebensmittel','Mobilität','Freizeit','Versicherung','Abos','Sonstiges','Sparen/Invest'];
const KIND={etf:'ETF',aktie:'Aktien',cash:'Cash',gold:'Gold & Edelmetalle',immo:'Immobilien',sonst:'Sonstiges',crypto:'Krypto'},COL={etf:'var(--ink)',aktie:'#5b6cff',cash:'var(--mut)',gold:'#d4a017',immo:'#1f9d63',sonst:'#9b59b6',crypto:'var(--or)'};
let yr='';let S={tx:[],as:[],goals:[],rec:[],debts:[],hist:[],sales:[],ui:{c:{},o:{}},th:'light',f:{wr:4,exp:'',r:6}},tab='home',mo=ymOf(),mem=null;
function sanitizeImportedValue(v,depth=0){
if(depth>12)throw new Error('Backup ist zu tief verschachtelt.');
if(typeof v==='string')return v.replace(/[<>&\"\u0000-\u001f\u007f]/g,'').slice(0,5000);
if(typeof v==='number')return Number.isFinite(v)?v:null;
if(typeof v==='boolean'||v===null)return v;
if(Array.isArray(v)){if(v.length>20000)throw new Error('Zu viele Einträge im Backup.');return v.map(x=>sanitizeImportedValue(x,depth+1))}
if(v&&typeof v==='object'){const out={};const entries=Object.entries(v);if(entries.length>500)throw new Error('Zu viele Felder im Backup.');for(const [key,val] of entries){if(['__proto__','prototype','constructor'].includes(key))continue;const k=key.replace(/[<>&\u0000-\u001f\u007f]/g,'').slice(0,200);if(k)out[k]=sanitizeImportedValue(val,depth+1)}return out}
throw new Error('Unzulässiger Datentyp im Backup.')
}
/* Import-Prüfung (S-17). Nur der Dateiimport übergibt einen Bericht und prüft streng: ungültige Datensätze werden verworfen und gezählt, nichts still verschluckt. Lokaler Stand und Sicherungen laufen ohne Bericht wie bisher, damit beim Start nichts verloren geht. */
const IMPORT_MAX_BETRAG=1e9,IMPORT_MODI=['man','nw','cash','etf','crypto'];
const importZaehl=(map,g)=>{map[g]=(map[g]||0)+1};
function istKalendertag(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const[y,m,d]=s.split('-').map(Number),t=new Date(Date.UTC(y,m-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d}
function istMonat(s){return typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s)}
/* Zahl aus dem Backup. Text nur, wenn das Format eindeutig ist: 12,50 · 1.234,50 · 12.50. „1.234“ bleibt mehrdeutig (null). */
function betragAus(v){if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v!=='string')return null;const t=v.replace(/[\s€]/g,'');if(/^-?\d+$|^-?\d+\.\d{1,2}$/.test(t))return Number(t);if(/^-?(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/.test(t))return Number(t.replace(/\./g,'').replace(',','.'));return null}
/* Prüft einen Datensatz. Gibt den Grund für die Verwerfung zurück oder null. Korrekturen zählen nur, wenn der Datensatz übernommen wird. */
function importPruefe(k,row,rep){
const kors=[],kor=g=>kors.push(g),hat=(o,f)=>Object.prototype.hasOwnProperty.call(o,f);
const betrag=(o,name,pflicht)=>{const v=o[name];if(v===undefined||v===null){if(pflicht)return 'Betrag fehlt';o[name]=0;return null}const n=betragAus(v);if(n===null)return 'Betrag keine gültige Zahl';if(Math.abs(n)>IMPORT_MAX_BETRAG)return 'Betrag außerhalb des Bereichs';if(typeof v==='string')kor('Textbetrag als Zahl übernommen');o[name]=n;return null};
const kat=o=>{if(o.c===undefined)return null;if(![...IN,...OUT].includes(o.c)){kor('Kategorie unbekannt, als Sonstiges übernommen');o.c='Sonstiges'}return null};
const art=o=>{if(o.k!==undefined&&!hat(KIND,o.k)){kor('Art unbekannt, als Sonstiges übernommen');o.k='sonst'}return null};
/* Optionale Zahl (B-19: Zins 0 bis 100, Rate ab 0). Ungültig: Feld entfernt, Datensatz bleibt; die Meldung zählt als korrigiert. */
const optZahl=(o,name,max,msg)=>{const v=o[name];if(v===undefined)return;const n=typeof v==='string'?betragAus(v):v;if(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max){if(typeof v==='string')kor('Textbetrag als Zahl übernommen');o[name]=n}else{delete o[name];kor(msg)}};
const grund=(()=>{
if(k==='tx'||k==='rec'){if(k==='tx'&&!istKalendertag(row.d))return 'Datum ungültig';kat(row);return betrag(row,'a',true)}
if(k==='as'){art(row);for(const n of ['q','p','c']){const g=betrag(row,n,n!=='c');if(g)return g}
if(row.l!==undefined){if(!Array.isArray(row.l))return 'Kaufliste ungültig';for(const x of row.l){if(!x||typeof x!=='object'||Array.isArray(x))return 'Kauf ungültig';if(x.d!==undefined&&x.d!==''&&!istKalendertag(x.d))return 'Kaufdatum ungültig';for(const n of ['q','p','f']){const g=betrag(x,n,n!=='f');if(g)return g}}}return null}
if(k==='goals'){if(row.m!==undefined&&!IMPORT_MODI.includes(row.m)){kor('Stand-Berechnung unbekannt, als manuell übernommen');row.m='man'}const g=betrag(row,'t',true);return g||betrag(row,'c',false)}
if(k==='debts'){const g=betrag(row,'a',true);if(g)return g;optZahl(row,'r',100,'Zins ungültig, Feld entfernt');optZahl(row,'rate',IMPORT_MAX_BETRAG,'Rate ungültig, Feld entfernt');return null}
if(k==='hist'){if(!istMonat(row.m))return 'Monat ungültig';return betrag(row,'nw',true)}
if(k==='sales'){if(!istKalendertag(row.d))return 'Datum ungültig';art(row);const g=betrag(row,'g',true);return g||betrag(row,'gc',false)||betrag(row,'gp',false)}
if(k==='pi'){if(!istKalendertag(row.d))return 'Datum ungültig';return betrag(row,'a',true)}
return null})();
if(!grund)kors.forEach(g=>importZaehl(rep.korrigiert,g));
return grund
}
function normalizeImportedState(raw,rep){
if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Das Backup muss ein JSON-Objekt sein.');
const streng=!!rep;
const clean=sanitizeImportedValue(raw),keys=['tx','as','goals','rec','debts','hist','sales'],base={tx:[],as:[],goals:[],rec:[],debts:[],hist:[],sales:[],ui:{c:{},o:{}},th:'light',f:{wr:4,exp:'',r:6}};
const textField=(row,k,def='')=>typeof row[k]==='string'?row[k]:def;
const numberField=(row,k,def=0)=>Number.isFinite(row[k])?row[k]:def;
/* S-18: Die Nutzerkennung kommt aus einer Datei nie in den Stand. Sie wird beim nächsten Sync neu gesetzt. */
if(streng)delete clean.uid;
for(const k of keys){
if(clean[k]===undefined)clean[k]=[];
if(!Array.isArray(clean[k]))throw new Error('Ungültige Datenstruktur: '+k+' muss eine Liste sein.');
if(clean[k].length>20000)throw new Error('Zu viele Datensätze in '+k+'.');
clean[k]=clean[k].filter(row=>{
if(!row||typeof row!=='object'||Array.isArray(row)){if(streng){importZaehl(rep.verworfen,'kein Datensatz (Text oder Zahl)');return false}throw new Error('Ungültiger Datensatz in '+k+'.')}
if(streng){const g=importPruefe(k,row,rep);if(g){importZaehl(rep.verworfen,g);return false}rep.uebernommen++}
if(typeof row.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(row.id))row.id=uid();
if(k==='tx'){row.d=textField(row,'d');row.c=textField(row,'c','Sonstiges');row.a=numberField(row,'a');row.n=textField(row,'n');row.r=typeof row.r==='string'?row.r:null}
if(k==='as'){row.n=textField(row,'n');row.k=textField(row,'k','sonst');row.q=numberField(row,'q');row.p=numberField(row,'p');row.c=numberField(row,'c');if(row.l!==undefined){if(!Array.isArray(row.l))row.l=[];row.l=row.l.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)).map(x=>({d:textField(x,'d'),q:numberField(x,'q'),p:numberField(x,'p'),f:numberField(x,'f')}))}if(typeof row.cg==='string'&&!/^[a-z0-9-]{1,100}$/i.test(row.cg))row.cg='';if(row.m==='e')delete row.l;else delete row.m}
if(k==='goals'){row.n=textField(row,'n');row.t=numberField(row,'t');row.y=row.y==null?'':textField(row,'y',String(row.y));row.m=textField(row,'m','man');row.c=numberField(row,'c')}
if(k==='rec'){row.c=textField(row,'c','Sonstiges');row.a=numberField(row,'a');row.n=textField(row,'n');row.e=!!row.e}
if(k==='debts'){row.n=textField(row,'n');row.a=numberField(row,'a');for(const[f,max]of[['r',100],['rate',IMPORT_MAX_BETRAG]])if(row[f]!==undefined&&!(Number.isFinite(row[f])&&row[f]>=0&&row[f]<=max))delete row[f]}
if(k==='hist'){row.m=textField(row,'m');row.nw=numberField(row,'nw')}
if(k==='sales'){row.n=textField(row,'n');row.d=textField(row,'d');row.k=textField(row,'k','sonst');row.g=numberField(row,'g');row.gc=numberField(row,'gc');row.gp=numberField(row,'gp')}
return true});
}
if(clean.pi&&Array.isArray(clean.pi.items)){
if(streng)clean.pi.items=clean.pi.items.filter(x=>{if(!x||typeof x!=='object'||Array.isArray(x)){importZaehl(rep.verworfen,'kein Datensatz (Text oder Zahl)');return false}const g=importPruefe('pi',x,rep);if(g){importZaehl(rep.verworfen,g);return false}rep.uebernommen++;return true});
clean.pi.items.forEach(x=>{if(x&&typeof x==='object'&&(typeof x.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(x.id)))x.id=uid()});
}
const out={...base,...clean};
out.ui=clean.ui&&typeof clean.ui==='object'&&!Array.isArray(clean.ui)?{c:{},o:{},...clean.ui}:{c:{},o:{}};
for(const k of ['c','o'])if(!out.ui[k]||typeof out.ui[k]!=='object'||Array.isArray(out.ui[k]))out.ui[k]={};
out.f=clean.f&&typeof clean.f==='object'&&!Array.isArray(clean.f)?{...base.f,...clean.f}:{...base.f};
if(!['light','dark','auto'].includes(out.th))out.th='light';
return out
}
try{const j=localStorage.getItem('fr_s');if(j)S=normalizeImportedState(JSON.parse(j))}catch(e){/* Rohdaten unter eigenem Schlüssel sichern, bevor der erste Speichervorgang sie überschreibt */try{const raw=localStorage.getItem('fr_s');if(raw){localStorage.setItem(localStorage.getItem('fr_s_defekt')?'fr_s_defekt_'+Date.now():'fr_s_defekt',raw)}}catch(x){/* Sicherung nicht möglich (Speicher voll oder gesperrt): App startet trotzdem. */}}
// ==== Supabase: Zugangsdaten stehen in config.js ====
const CFG=window.FR_CONFIG||{},SB_URL=CFG.url||'',SB_KEY=CFG.key||'';
const sb=(SB_URL&&SB_KEY&&window.supabase)?window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
let user=null,syncMsg='',syncOk=null,tmr=null,authReady=!sb,recMode=false,busy=false,lem='';
let legacyPending=false,legacyCheckError='',legacyCheckedUserId='';
/* cloudReady: für diesen Nutzer ist der Cloud-Stand bekannt (erst dann darf hochgeladen werden). saveSeq: zählt lokale Änderungen. S.ts ist der Stand der letzten Cloud-Fassung, die wir kennen. */
let cloudReady='',saveSeq=0;
/* Lokale Sicherung in der Liste 'Sicherungen' (Mehr → Datenschutz), bevor Cloud-Daten lokale ersetzen oder Cloud-Daten überschrieben werden. */
function keepSnap(kind,d){try{const a=JSON.parse(localStorage.getItem('fr_bk')||'[]');const list=Array.isArray(a)?a:[];list.push({t:new Date().toISOString(),n:(d.tx||[]).length,u:d.uid||'',d:JSON.stringify(d),k:kind});while(list.length>5)list.shift();localStorage.setItem('fr_bk',JSON.stringify(list));return true}catch(e){return false}}
/* Konflikt bei der Synchronisierung (B-03): lokal ungesicherte Änderungen (fr_dirty) und ein neuerer Cloud-Stand mit anderem Inhalt. Nichts wird zusammengeführt; die Entscheidung trifft der Nutzer im Dialog. */
let konfl=false,kfOpen=false;
const dirty=()=>{try{return localStorage.getItem('fr_dirty')==='1'}catch(e){return false}};
const clearDirty=()=>{try{localStorage.removeItem('fr_dirty')}catch(e){/* Markierung nicht löschbar: der nächste Upload löscht sie. */}};
const kanon=v=>Array.isArray(v)?v.map(kanon):v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=kanon(v[k]),o),{}):v;
/* Nur Fachdaten zählen für den Konflikt. Darstellung (ui, th, hide) und Kennungen (ts, uid) lösen keinen Dialog aus. */
const SYNC_FACHDATEN=['tx','as','goals','rec','debts','hist','sales','f','spl','mnotes','msn','prPlans','lastImp','pi'];
/* Gleicher Inhalt der Fachdaten, unabhängig von Schlüsselreihenfolge. */
function sameData(a,b){const f=x=>{const c={};SYNC_FACHDATEN.forEach(k=>{if(x&&x[k]!==undefined)c[k]=x[k]});return JSON.stringify(kanon(c))};return f(a)===f(b)}
const leerStand=th=>({tx:[],as:[],goals:[],rec:[],debts:[],hist:[],sales:[],ui:{c:{},o:{}},th:th||'light',f:{wr:4,exp:'',r:6}});
function konfliktMelden(){retryStop();if(!konfl)kfOpen=true;konfl=true;syncOk=false;syncMsg='Synchronisierung pausiert: Die Cloud hat einen neueren Stand, und hier liegen ungesicherte Änderungen.';return render()}
async function konfliktWahl(w){
if(w==='spaeter'){kfOpen=false;return render()}
if(w==='behalten'){konfl=false;kfOpen=false;return push(true)}
if(!keepSnap('vor-cloud',S)){syncOk=false;syncMsg='Lokale Sicherung nicht möglich, Cloud-Stand nicht übernommen';return render()}
clearDirty();konfl=false;kfOpen=false;return pull(true)
}
function konfliktHTML(){
if(!konfl)return '';
if(!kfOpen)return '<div class="panel" role="status" style="border-color:var(--or)"><h2>Synchronisierung pausiert</h2><div class="note">Die Cloud hat einen neueren Stand als dieses Gerät, und hier liegen ungesicherte Änderungen. Nichts wurde überschrieben. Die Synchronisierung wartet auf deine Entscheidung.</div><button class="btn o" '+act('kfZeigen')+'>Entscheiden</button></div>';
return '<div class="qsh on" id="kf" role="dialog" aria-modal="true" aria-labelledby="kf_t"><div><h2 id="kf_t">Cloud-Stand ist neuer</h2><div class="note">In der Cloud liegt ein neuerer Stand, und auf diesem Gerät gibt es ungesicherte Änderungen. Beide Fassungen unterscheiden sich. Es wird nichts zusammengeführt. Sicherungen findest du unter Mehr → Datenschutz → Sicherungen.</div><button class="btn" id="kf_b1" '+act('konfliktWahl',['uebernehmen'])+'>Cloud-Stand übernehmen</button><div class="note">Die lokale Fassung wird vorher in die Sicherungen gelegt.</div><button class="btn o" id="kf_b2" '+act('konfliktWahl',['behalten'])+'>Diesen Stand behalten</button><div class="note">Die Cloud-Fassung wird vorher in die Sicherungen gelegt, danach wird hochgeladen.</div><button class="btn o" id="kf_b3" '+act('konfliktWahl',['spaeter'])+'>Später entscheiden</button><div class="note">Nichts wird geändert. Die Synchronisierung bleibt pausiert, bis du entschieden hast.</div></div></div>';
}
/* Anderes Konto angemeldet und lokal ungesicherte Änderungen des vorherigen Kontos (B-25): nichts übernehmen, nichts hochladen. */
const kontoOffen=()=>!!user&&!!S.uid&&S.uid!==user.id&&dirty();
function kontoHTML(){return '<div class="qsh on" id="kf" role="dialog" aria-modal="true" aria-labelledby="kf_t"><div><h2 id="kf_t">Anderes Konto angemeldet</h2><div class="note">Auf diesem Gerät liegen ungesicherte Änderungen aus dem vorherigen Konto. Sie gehören nicht zum angemeldeten Konto und werden nicht in dessen Cloud übernommen. Wähle, was damit geschehen soll.</div><button class="btn" id="kf_b1" '+act('kontoWahl',['sichern'])+'>Als Datei sichern und wechseln</button><div class="note">Lädt ein JSON-Backup des bisherigen Stands herunter. Danach wechselt die App.</div><button class="btn o" id="kf_b2" '+act('kontoWahl',['verwerfen'])+'>Verwerfen und wechseln</button><div class="note">Die ungesicherten Änderungen sind danach auf diesem Gerät nicht mehr vorhanden.</div><button class="btn o" id="kf_b3" '+act('kontoWahl',['abbrechen'])+'>Abbrechen</button><div class="note">Das neue Konto wird abgemeldet. Der bisherige Stand bleibt unverändert.</div></div></div>'}
async function kontoWahl(w){
if(!kontoOffen())return render();
if(w==='abbrechen')return logout(false);
if(w==='sichern'){if(!window.dlBackup)return render();window.dlBackup()}
S=leerStand(S.th);localSave();clearDirty();konfl=false;kfOpen=false;syncOk=null;syncMsg='';
return pull(true)
}
/* Neuversuch bei Fehlern (B-24): Netz, Zeitüberschreitung, 5xx. Fünf Versuche insgesamt (1 + 4 Wiederholungen), danach Stopp. Ereignisse „wieder online“ und Rückkehr in den Vordergrund versuchen sofort erneut. */
const SYNC_TIMEOUT_MS=20000,RETRY_MS=[5000,15000,45000,120000];
let retryN=0,retryTmr=null,retryAt=0;
const fehler=(m,status,lokal)=>Object.assign(new Error(m||'Unbekannter Fehler'),{status,lokal:!!lokal});
function mitZeit(p){let t;return Promise.race([p,new Promise((_,rej)=>{t=setTimeout(()=>rej(fehler('Zeitüberschreitung',0)),SYNC_TIMEOUT_MS)})]).finally(()=>clearTimeout(t))}
function retryPlan(){if(retryN>=RETRY_MS.length)return false;const ms=RETRY_MS[retryN++];clearTimeout(retryTmr);retryAt=Date.now()+ms;retryTmr=setTimeout(()=>{retryTmr=null;retryAt=0;push()},ms);return true}
function retryStop(){retryN=0;clearTimeout(retryTmr);retryTmr=null;retryAt=0}
/* Verständlicher Text. Neuversuch nur bei Netz, Zeitüberschreitung und 5xx; 401, 403, 413 und lokale Fehler nicht. */
function syncFehler(e){const s=Number(e.status)||0,netz=!e.lokal&&(s===0||s===408||s>=500);const txt={401:'Sitzung abgelaufen. Bitte erneut anmelden.',403:'Keine Berechtigung für diesen Datenstand.',413:'Der Datenstand ist zu groß für die Cloud.'}[s]||(s>=500?'Die Cloud antwortet gerade nicht.':netz?'Keine Verbindung zur Cloud oder Zeitüberschreitung.':String(e.message||e));syncOk=false;syncMsg='Nicht synchronisiert: '+txt;if(!netz)return retryStop();if(!retryPlan())syncMsg+=' Automatische Versuche beendet. Bei der nächsten Änderung, nach Netzrückkehr oder über „Jetzt hochladen“.'}
/* Sync-Status mit Restzeit bis zum nächsten Versuch (beim Neuzeichnen berechnet, nicht live). */
function syncText(){return syncMsg+(retryTmr?' Neuer Versuch in '+Math.max(1,Math.ceil((retryAt-Date.now())/1000))+' s.':'')}
/* Ereignis „wieder online“ oder Rückkehr in den Vordergrund: je Ereignis ein Versuch, wenn etwas aussteht. */
function syncNun(){if(!sb||!user||konfl||kontoOffen()||legacyPending)return;if(dirty()||syncOk===false){retryStop();push()}}
window.addEventListener('online',syncNun);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncNun()});
/* Tastatur im Dialog: Esc = Später entscheiden, Tab bleibt innerhalb der drei Schaltflächen. */
document.addEventListener('keydown',e=>{const ids=['kf_b1','kf_b2','kf_b3'].filter(i=>$(i));if(!ids.length)return;if(e.key==='Escape'){e.preventDefault();return kontoOffen()?kontoWahl('abbrechen'):konfliktWahl('spaeter')}if(e.key!=='Tab')return;const i=ids.findIndex(x=>$(x)===document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();$(ids[ids.length-1]).focus()}else if(!e.shiftKey&&(i<0||i===ids.length-1)){e.preventDefault();$(ids[0]).focus()}});
/* Aktionen ohne Inline-Handler (CSP script-src-attr 'none'). act(fn, args, ev) erzeugt data-click (bzw. data-change, data-input)
   und data-args als JSON-Array. Aufgerufen wird nur, was in ACTS steht. "$value", "$checked", "$el" und "$event" stehen für Wert, Haken, Element und Ereignis.
   Nutzerdaten in den Argumenten gehen über esc() in das Attribut. */
const ACTS=new Set(['kfZeigen','konfliktWahl','kontoWahl','goTab','continueWithCurrentData','pull','tg','sh','edStart','del','addDebt','addHist','edSave','edClose','cgRetry','setLrg','setLtop','liveNeu','setLsel','setEgm','setEgt','togEg','trdStart','doTr','trdClose','pick','feedUpd','applyRec','copyMo','addTx','sugg','addAs','setF','msNote','exportBackup','importBackup','addGoal','setFNum','setTxy','setYr','login','magic','forgot','setPw','pushNun','logout','logoutLokal','setP','saveRunway5','cancelRunway5','editRunway5','setBud','setAl','pinKey','setPin','lockNow','rmPin','setTf','setKist','setFx','fxToggle','setSpl','useSpl','dlBackup','pvToggle','setMNote','qSug','Q_manual','qClose','qSave','impAll','impSet','impGo','impClear','impFile','impUndo','secSet','snapRestore','piImport','piAdd','piDel','piSetF','setJob','qInvest','homeFull','hideN','theme','edMode','setAm','cgSuch','cgPick']);
const act=(fn,args=[],ev='click')=>{if(!ACTS.has(fn))throw new Error('Aktion nicht registriert: '+fn);return `data-${ev}="${fn}"`+(args.length?` data-args="${esc(JSON.stringify(args))}"`:'')};
/* Ein Ereignis, ein Dispatcher (einmal beim Laden). Alle Vorfahren mit Attribut laufen von innen nach außen, wie bei Inline-Handlern. */
function actRun(attr,e){
const hits=[];
for(let el=e.target&&e.target.closest?e.target.closest('['+attr+']'):null;el;el=el.parentElement&&el.parentElement.closest?el.parentElement.closest('['+attr+']'):null)hits.push(el);
hits.forEach(el=>{const fn=el.getAttribute(attr);if(!ACTS.has(fn))throw new Error('Aktion nicht registriert: '+fn);
const args=JSON.parse(el.getAttribute('data-args')||'[]').map(a=>a==='$value'?el.value:a==='$checked'?el.checked:a==='$el'?el:a==='$event'?e:a);
try{window[fn](...args)}catch(err){setTimeout(()=>{throw err})}});
}
document.addEventListener('click',e=>actRun('data-click',e));
document.addEventListener('change',e=>actRun('data-change',e));
document.addEventListener('input',e=>actRun('data-input',e));
const em=m=>({'Invalid login credentials':'E-Mail oder Passwort falsch.','Email not confirmed':'Bitte zuerst den Link in der Bestätigungs-Mail öffnen.','User already registered':'Diese E-Mail ist schon registriert: bitte anmelden.'}[m]||String(m||'Unbekannter Fehler'));
function localSave(){try{localStorage.setItem('fr_s',JSON.stringify(S))}catch(e){/* Speicher voll oder gesperrt: Stand bleibt im Arbeitsspeicher, der Upload läuft weiter. */}}
function save(){localSave();saveSeq++;try{localStorage.setItem('fr_dirty','1')}catch(e){/* Markierung „ungesichert“ nicht setzbar: die Synchronisierung läuft trotzdem. */}if(sb&&user&&!legacyPending&&!legacyCheckError&&!konfl&&!kontoOffen()){syncOk=null;clearTimeout(tmr);tmr=setTimeout(push,SYNC_DELAY_MS)}}
/* Upload. force: Konflikt ist entschieden („Diesen Stand behalten“); die Cloud-Fassung wird trotzdem vorher gesichert. */
async function push(force){if(!sb||!user||legacyPending||legacyCheckError||kontoOffen())return;if(cloudReady!==user.id)return pull(true);if(konfl&&!force)return;/* erst den Cloud-Stand kennen: ein leerer lokaler Stand darf die Cloud nicht überschreiben */const ts=Date.now(),seq=saveSeq;try{const cur=await mitZeit(sb.from('finance_state').select('data,updated_at').eq('user_id',user.id).maybeSingle());if(cur.error)throw fehler(cur.error.message||'Cloud-Stand nicht lesbar',cur.status);const newer=!!(cur.data&&cur.data.data)&&new Date(cur.data.updated_at).getTime()>(S.ts||0);if(newer&&!force){if(!dirty()||sameData(S,cur.data.data))return pull(true);/* lokal ohne Änderungen oder gleicher Inhalt: Cloud laden statt überschreiben */return konfliktMelden()}if(newer&&!keepSnap('cloud',cur.data.data))throw fehler('Lokale Sicherung nicht möglich, Upload abgebrochen',0,true);const up=await mitZeit(sb.from('finance_state').upsert({user_id:user.id,data:{...S,ts,uid:user.id},updated_at:new Date(ts).toISOString()}));if(up.error)throw fehler(up.error.message||'Upload fehlgeschlagen',up.status);S.ts=ts;S.uid=user.id;localSave();konfl=false;kfOpen=false;retryStop();syncOk=true;syncMsg='Synchronisiert '+new Date().toLocaleTimeString('de-DE');if(seq===saveSeq)clearDirty()}catch(e){syncFehler(e)}}
async function pull(auto){
if(!sb||!user)return;
if(kontoOffen())return render();
if(S.uid&&S.uid!==user.id)S=leerStand(S.th);
let r;try{r=await mitZeit(sb.from('finance_state').select('data,updated_at').eq('user_id',user.id).maybeSingle())}catch(e){r={error:e}}
if(r.error){syncFehler(fehler(r.error.message||String(r.error),r.status||r.error.status));return render()}
const data=r.data;
if(data){legacyPending=false;legacyCheckError='';cloudReady=user.id;const cts=new Date(data.updated_at).getTime();if(cts>(S.ts||0)&&dirty()&&!sameData(S,data.data))return konfliktMelden();if(cts>(S.ts||0)||!auto){if(dirty()&&(S.tx.length||S.as.length||S.goals.length||S.debts.length)&&!keepSnap('vor-cloud',S)){syncOk=false;syncMsg='Lokale Sicherung nicht möglich, Cloud-Stand nicht übernommen';return render()}S={...S,...data.data,ts:cts,uid:user.id};localSave();clearDirty();konfl=false;kfOpen=false;retryStop();syncOk=true;syncMsg='Aus Cloud geladen'}else{await push()}return render()}
// Before creating a new cloud row, check for the older app's schema.
// It is intentionally kept intact; finance_state and user_state are different formats.
if(legacyCheckedUserId!==user.id){
  let old;try{old=await sb.from('user_state').select('app_state,updated_at').eq('user_id',user.id).maybeSingle()}catch(e){old={error:e}}
  if(old.error){legacyCheckError='Der vorhandene Cloud-Datenstand konnte nicht geprüft werden. Die automatische Synchronisierung bleibt pausiert, damit nichts versehentlich überschrieben wird.';syncOk=false;syncMsg=legacyCheckError;return render()}
  legacyCheckedUserId=user.id;
  if(old.data&&old.data.app_state){legacyPending=true;syncOk=null;syncMsg='Ältere Cloud-Daten gefunden. Bitte vor dem Start entscheiden.';return render()}
}
cloudReady=user.id;await push();render()
}
async function continueWithCurrentData(){
if(!sb||!user)return;
if(!confirm('Der vorhandene ältere Datensatz in user_state bleibt unverändert erhalten, wird von dieser App aber nicht automatisch übernommen. Soll der aktuelle lokale Finanz-Radar-Datenstand jetzt in finance_state gespeichert werden? Exportiere lokale Daten vorher unter Mehr → Daten & Backup, falls du sie sichern möchtest.'))return;
const check=await sb.from('finance_state').select('user_id').eq('user_id',user.id).maybeSingle();
if(check.error){alert('Cloud-Status konnte nicht geprüft werden. Es wurde nichts geschrieben.');return}
if(check.data){legacyPending=false;legacyCheckError='';return pull(true)}
legacyPending=false;legacyCheckError='';S.uid=user.id;localSave();clearTimeout(tmr);cloudReady=user.id;await push();render()
}
function legacyNotice(){
if(legacyPending)return `<div class="panel" style="border-color:var(--or)"><h2>Älterer Cloud-Datenstand erkannt</h2><div class="note">In diesem Supabase-Konto liegt bereits ein älterer Datenstand in <b>user_state</b>. Er verwendet ein anderes Datenformat und wurde nicht verändert. Finanz-Radar synchronisiert erst, wenn du dich entscheidest. Sichere gegebenenfalls zuerst lokale Daten über Mehr → Daten & Backup.</div><button class="btn o" ${act('goTab',['data'])}>Lokales Backup öffnen</button><button class="btn" ${act('continueWithCurrentData')}>Mit dem aktuellen Finanz-Radar-Datenstand starten</button></div>`;
if(legacyCheckError)return `<div class="panel" style="border-color:var(--or)"><h2>Cloud-Synchronisierung pausiert</h2><div class="note">${esc(legacyCheckError)}</div><button class="btn o" ${act('pull',[true])}>Erneut prüfen</button><button class="btn" ${act('continueWithCurrentData')}>Trotzdem mit lokalem Datenstand starten</button></div>`;
return ''
}
async function initAuth(){if(!sb)return;try{const{data}=await sb.auth.getSession();user=data.session?data.session.user:null;sb.auth.onAuthStateChange((ev,ses)=>{const u=ses?ses.user:null,was=user;user=u;if(!u){legacyPending=false;legacyCheckError='';legacyCheckedUserId='';cloudReady='';konfl=false;kfOpen=false;retryStop();clearTimeout(tmr)}if(ev==='PASSWORD_RECOVERY')recMode=true;if(u&&(!was||was.id!==u.id))setTimeout(()=>pull(true),0);else render()});if(user)await pull(true)}catch(e){syncMsg=em(e.message||e)}authReady=true;render()}
async function login(up){if(busy)return;const e=$('le').value.trim(),p=$('lp').value;lem=e;if(!e||p.length<6){syncMsg='E-Mail und Passwort (mind. 6 Zeichen) eingeben.';return render()}busy=true;let r;try{r=up?await sb.auth.signUp({email:e,password:p,options:{emailRedirectTo:location.origin+location.pathname}}):await sb.auth.signInWithPassword({email:e,password:p})}catch(x){r={error:x}}busy=false;syncMsg=r.error?em(r.error.message):(up&&!(r.data&&r.data.session)?'Fast geschafft: Die Bestätigungs-Mail ist unterwegs. Bitte den Link öffnen und danach anmelden.':'');render()}
async function magic(){const e=$('le').value.trim();lem=e;if(!e){syncMsg='Bitte E-Mail eingeben.';return render()}const r=await sb.auth.signInWithOtp({email:e,options:{emailRedirectTo:location.origin+location.pathname}});syncMsg=r.error?em(r.error.message):'Login-Link wurde per E-Mail gesendet.';render()}
async function forgot(){const e=$('le').value.trim();lem=e;if(!e){syncMsg='Bitte E-Mail eingeben.';return render()}const r=await sb.auth.resetPasswordForEmail(e,{redirectTo:location.origin+location.pathname});syncMsg=r.error?em(r.error.message):'Link zum Zurücksetzen wurde per E-Mail gesendet.';render()}
async function setPw(){const p=$('np').value;if(p.length<6){syncMsg='Mindestens 6 Zeichen.';return render()}const r=await sb.auth.updateUser({password:p});if(r.error)syncMsg=em(r.error.message);else{syncMsg='Passwort geändert.';recMode=false}render()}
async function logout(wipe){await sb.auth.signOut();user=null;konfl=false;kfOpen=false;retryStop();clearTimeout(tmr);syncMsg='';if(wipe){try{localStorage.removeItem('fr_s');localStorage.removeItem('fr_bk');localStorage.removeItem('fr_exp');localStorage.removeItem('fr_dirty');for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith('fr_s_defekt'))localStorage.removeItem(k)}}catch(e){/* Einzelner Schlüssel nicht löschbar: die übrigen Löschungen laufen weiter. */}location.reload();return}render()}
function applyTh(){const t=S.th||'light';if(t==='auto')document.documentElement.removeAttribute('data-theme');else document.documentElement.dataset.theme=t;document.body.classList.toggle('hide',!!S.hide);const b=$('th');if(b)b.textContent=t==='light'?'☀':t==='dark'?'☾':'◐'}
function blurNums(){
const root=$('v');if(!root)return;blurHtml();
const NS='http://www.w3.org/2000/svg';
root.querySelectorAll('svg text').forEach(el=>{
const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];
while(walker.nextNode()){const n=walker.currentNode;if(!n.parentElement?.classList.contains('n'))nodes.push(n)}
nodes.forEach(n=>{const txt=n.nodeValue;if(!/\d/.test(txt))return;const frag=document.createDocumentFragment();let last=0,m,re=/\d[\d.,]*/g;
while((m=re.exec(txt))){if(m.index>last)frag.append(document.createTextNode(txt.slice(last,m.index)));const t=document.createElementNS(NS,'tspan');t.setAttribute('class','n');t.textContent=m[0];frag.append(t);last=re.lastIndex}
if(last<txt.length)frag.append(document.createTextNode(txt.slice(last)));n.replaceWith(frag)});
});
}
function blurHtml(){const root=$('v');if(!root)return;
const re=/[+\-−]?\d[\d.]*(?:,\d+)?\s?(?:€|%(?:-Pkt\.)?|Jahre?n?\b|J\.|Monate?n?\b|Mon\.)/gi,SKIP=/^(SCRIPT|STYLE|INPUT|TEXTAREA|SELECT|OPTION|BUTTON|SVG|TEXT|TSPAN)$/;
const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){const p=n.parentElement;if(!p||SKIP.test(p.tagName.toUpperCase())||p.closest('.n,button,.chip,svg,select,textarea'))return NodeFilter.FILTER_REJECT;re.lastIndex=0;return re.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}}),nodes=[];
while(w.nextNode())nodes.push(w.currentNode);
nodes.forEach(n=>{const t=n.nodeValue,f=document.createDocumentFragment();let last=0,m;re.lastIndex=0;while((m=re.exec(t))){if(m.index>last)f.append(document.createTextNode(t.slice(last,m.index)));const s=document.createElement('span');s.className='n';s.textContent=m[0];f.append(s);last=re.lastIndex}if(last<t.length)f.append(document.createTextNode(t.slice(last)));n.replaceWith(f)})}
function hideN(){S.hide=!S.hide;save();applyTh();render()}
function cu(){if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;document.querySelectorAll('.k.big b').forEach(e=>{const m=e.textContent.match(/^(-?[\d.]+) €$/);if(!m)return;const to=parseInt(m[1].replace(/\./g,''),10),s0=performance.now();(function f(n){const p=Math.min(1,(n-s0)/700);e.textContent=Math.round(to*(1-Math.pow(1-p,3))).toLocaleString('de-DE')+' €';if(p<1)requestAnimationFrame(f)})(s0)})}
const P=(t,h)=>{const key=tab+':'+((t.match(/^\[([^\]]+)\]/)||[0,t])[1]),id=esc(key),c=S.ui&&S.ui.c[id];return `<div class="panel" data-pk="${id}"><h2><span class="hd" data-pn="1">⠿</span><span style="flex:1;cursor:pointer" ${act('tg',[key])}>${t}</span><span class="mut" style="cursor:pointer" ${act('tg',[key])}>${c?'▸':'▾'}</span></h2>${c?'':h}</div>`},N=i=>{const v=parseFloat(String($(i).value).replace(',','.'));return isFinite(v)?v:0};
const mt=()=>S.tx.filter(x=>x.d.startsWith(mo)),sm=(l,t)=>l.filter(x=>IN.includes(x.c)===(t==='in')&&(t==='in'||x.c!=='Sparen/Invest')).reduce((s,x)=>s+x.a,0);
const invSum=l=>l.filter(x=>x.c==='Sparen/Invest').reduce((s,x)=>s+x.a,0);
const val=a=>a.q*a.p,dt=()=>S.debts.reduce((s,d)=>s+d.a,0),nw=()=>S.as.reduce((s,a)=>s+val(a),0),nn=()=>nw()-dt(),wrOf=()=>Number(S.f.wr)>0?Number(S.f.wr):DEFAULT_WR_PCT,fireF=()=>Number(S.f.fireTarget)>0?Number(S.f.fireTarget):(ausgabenBasis().wert*12)/(wrOf()/100),gv=g=>({nw:nn(),cash:byK('cash'),etf:byK('etf'),crypto:byK('crypto')}[g.m]??g.c),bk=()=>`<button class="btn o" style="margin:0" ${act('goTab',['more'])}>‹ Mehr</button>`,byK=k=>S.as.filter(a=>a.k===k).reduce((s,a)=>s+val(a),0);
/* Monatsdurchschnitt in einem Durchlauf: je Monat einmal summieren. Vorher wurden für jeden Monat alle Buchungen gefiltert (quadratisch, Fuck-Off-Ansicht ~45 ms). */
function avg(){const g=new Map();S.tx.forEach(x=>{const k=x.d.slice(0,7);let b=g.get(k);if(!b)g.set(k,b={i:0,o:0,s:0});if(IN.includes(x.c))b.i+=x.a;else if(x.c!=='Sparen/Invest')b.o+=x.a;if(x.c==='Sparen/Invest')b.s+=x.a});if(!g.size)return{i:0,o:0,s:0};let i=0,o=0,s=0;g.forEach(b=>{i+=b.i;o+=b.o;s+=b.s});return{i:i/g.size,o:o/g.size,s:s/g.size}}
/* Ausgaben-Basis für Fuck-Off-Zahl und -Rechner (B-16): eigene Eingabe, sonst Ø Ausgaben aus den Buchungen. Fixkosten bleiben für Notgroschen und Runway. */
function ausgabenBasis(){const e=parseFloat(S.f.exp);return e?{wert:e,quelle:'eigene Eingabe'}:{wert:avg().o,quelle:'Ø Ausgaben'}}
function basisText(){const b=ausgabenBasis();return 'Basis: '+(b.quelle==='eigene Eingabe'?b.quelle:b.quelle+' '+eur(b.wert)+'/Monat')}
/* Steuer-Annahmen (B-17): Kirchensteuer 0, 8 oder 9 % (S.f.kist); Teilfreistellung der Prognose und des Fuck-Off-Rechners in S.f.tf (Standard 30 %). Fehlt ein Feld, gilt der Standard. */
const KIST_OPTIONEN=[0,8,9];
function kistWert(){const k=Number(S.f.kist);return KIST_OPTIONEN.includes(k)?k:0}
function tfWert(){const t=Number(S.f.tf);return S.f.tf==null||S.f.tf===''||!isFinite(t)?30:t}
const pct3=v=>isFinite(v)?v.toLocaleString('de-DE',{minimumFractionDigits:3,maximumFractionDigits:3}):'–';
/* Gesamtsatz der Abgeltungsteuer mit Kirchensteuer k (in %). Vereinfacht: Steuersatz = 25 % / (1 + 0,25 × k), plus Soli 5,5 % auf die Steuer, plus Kirchensteuer k × Steuer. Ohne Kirchensteuer gilt TAX_KAP_PCT (26,375 %). */
function kirchSatz(k){if(!k)return TAX_KAP_PCT;const q=k/100,st=KAP_ESt_PCT/(1+(KAP_ESt_PCT/100)*q);return st*(1+SOLI_PCT/100+q)}
function moNav(){const[y,m]=mo.split('-');return`<div class="nav"><button class="btn o" aria-label="Vormonat" ${act('sh',[-1])}>‹</button><div>${new Date(y,m-1).toLocaleDateString('de-DE',{month:'long',year:'numeric'}).toUpperCase()}</div><button class="btn o" aria-label="Folgemonat" ${act('sh',[1])}>›</button></div>`}
function sh(d){const[y,m]=mo.split('-').map(Number),n=new Date(y,m-1+d,1);mo=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0');render()}
function del(k,id){S[k]=S[k].filter(x=>x.id!==id);save();render()}
function applyRec(){S.rec.forEach(r=>{if(!S.tx.some(x=>x.r===r.id&&x.d.startsWith(mo)))S.tx.push({id:uid(),d:mo+'-01',c:r.c,a:r.a,n:r.n,r:r.id})});save();render()}
function copyMo(){const[y,m]=mo.split('-').map(Number),pm=new Date(y,m-2,1),k=pm.getFullYear()+'-'+String(pm.getMonth()+1).padStart(2,'0');S.tx.filter(x=>x.d.startsWith(k)).forEach(x=>{if(!S.tx.some(z=>z.d.startsWith(mo)&&z.c===x.c&&z.a===x.a&&z.n===x.n))S.tx.push({...x,id:uid(),d:mo+'-'+clampDay(mo,x.d.slice(8))})});save();render()}
function addDebt(){const a=N('da'),n=clean($('dn').value);if(!n||!(a>0))return;const z=optEingabe($('dz').value,'r'),ra=optEingabe($('dr').value,'rate'),f=!z.ok?z:!ra.ok?ra:null;if(f){$('dfehl').textContent=f.msg;return}const d={id:uid(),n,a};if(z.v!==undefined)d.r=z.v;if(ra.v!==undefined)d.rate=ra.v;S.debts.push(d);save();render()}
function setP(id,v){const a=S.as.find(x=>x.id===id);if(a){a.p=parseFloat(String(v).replace(',','.'))||0;save();render()}}
/* Schulden mit Zins und Tilgung (B-19). Optional je Schuld: r = Zinssatz % p. a. (0 bis 100), rate = monatliche Rate € (≥ 0).
   Monatlicher Zins i = r/12/100. Die erste Rate fällt im Folgemonat an, das Ende ist der Monat heute + n. Obergrenze 100 Jahre. */
const DEBT_MAX_MONATE=1200;
function schuldPlan(B,r,rate,heute){
if(!(B>0))return{art:'getilgt'};
if(!(rate>0))return{art:'keine-rate'};
const i=r/1200,zins=i*B;
if(rate<=zins)return{art:'zins',zins};
const n=i===0?Math.ceil(B/rate):Math.ceil(-Math.log(1-zins/rate)/Math.log(1+i));
const rest=k=>{const q=Math.pow(1+i,k);return Math.max(0,i===0?B-rate*k:B*q-rate*(q-1)/i)};
const p={art:'plan',zins,n,rest12:rest(12),lang:n>DEBT_MAX_MONATE};
if(p.lang)return p;
const h=heute||new Date();
p.ende=new Date(h.getFullYear(),h.getMonth()+n,1);
if(i===0)p.gesamt=0;else{const q=Math.pow(1+i,n-1),bl=B*q-rate*(q-1)/i;p.gesamt=(n-1)*rate+bl*(1+i)-B}
return p}
/* Optionale Zahl für Zins (r, 0 bis 100) und Rate (ab 0), B-19. Leer heißt „nicht angegeben“: das Feld fehlt im Datensatz. */
const OPT_DEBT={r:[0,100,'Zins bitte als Zahl von 0 bis 100 eingeben (% p. a.).'],rate:[0,Infinity,'Rate bitte als Zahl ab 0 eingeben (Euro je Monat).']};
function optEingabe(raw,f){const s=String(raw||'').trim();if(!s)return{ok:true};const[lo,hi,msg]=OPT_DEBT[f],x=Number(s.replace(',','.'));return /^\d+(?:[.,]\d+)?$/.test(s)&&x>=lo&&x<=hi?{ok:true,v:x}:{ok:false,msg}}
const laufzeitText=n=>{const j=Math.floor(n/12),m=n%12,J=j+' Jahr'+(j>1?'e':''),M=m+' Monat'+(m>1?'e':'');return j&&m?J+' '+M:j?J:M};
/* Zeilen unter der Schuld mit Zins und Rate (B-19). Fehlt eines der Felder, bleibt die Zeile wie bisher. */
const schuldInfo=d=>{if(typeof d.r!=='number'||typeof d.rate!=='number')return '';const p=schuldPlan(d.a,d.r,d.rate),kopf=`<small>Zins ${pct(d.r)} p. a., Rate ${eur(d.rate)} im Monat</small>`;
if(p.art==='getilgt')return '<small>Getilgt</small>';
if(p.art==='keine-rate')return kopf+'<small><span class="neg">Keine Rate eingetragen, daher keine Laufzeit</span></small>';
if(p.art==='zins')return kopf+`<small><span class="neg">Die Rate deckt die Zinsen nicht (${eur(p.zins)} im Monat). Die Schuld wächst.</span></small>`;
const ende=p.lang?'':`, Ende ${p.ende.toLocaleDateString('de-DE',{month:'long',year:'numeric'})}`;
return kopf+`<small>Laufzeit ${p.lang?'länger als 100 Jahre':laufzeitText(p.n)+ende}</small>`+(p.lang?'':`<small>Zinsen bis zum Ende ${eur(p.gesamt)}</small>`)+`<small>Restschuld in 12 Monaten ${eur(p.rest12)}</small>`};
const debtsHTML=()=>P('[Schulden] '+eur(dt()),S.debts.map(d=>edRow('debts',d,`<div class="li" data-k="debts" data-id="${d.id}"><span><span class="hd">⠿</span>${esc(d.n)}${schuldInfo(d)}</span><span class="neg">${eur(d.a)} <button class="btn x" aria-label="Bearbeiten" ${act('edStart',['debts',d.id])}>✎</button> <button class="btn x" aria-label="Löschen" ${act('del',['debts',d.id])}>×</button></span></div>`)).join('')+`<div class="row" style="margin-top:8px"><input aria-label="Bezeichnung der Schuld" id="dn" placeholder="Bezeichnung"><input aria-label="Betrag in Euro" id="da" type="number" inputmode="decimal" placeholder="Betrag €"></div><div class="row"><div><label for="dz">Zins % p. a. (optional)</label><input id="dz" aria-label="Zins in Prozent pro Jahr, optional" type="text" inputmode="decimal" placeholder="z. B. 5"></div><div><label for="dr">Monatliche Rate € (optional)</label><input id="dr" aria-label="Monatliche Rate in Euro, optional" type="text" inputmode="decimal" placeholder="z. B. 300"></div></div><div class="note">Zins und Rate zusammen ergeben Laufzeit, Ende, Zinsen und Restschuld.</div><div class="neg" id="dfehl" role="alert"></div><button class="btn o" ${act('addDebt')}>Schuld hinzufügen</button>`);
const kzHTML=()=>{const F=fireF(),n=nn();return P('[Kennzahlen]',[['Assets',eur(nw())],['Schulden',eur(dt())],['Net Worth',eur(n)],['Liquidität',eur(byK('cash'))],['Realisierte G/V',eur(S.real||0)],['FIRE Fortschritt',pct(F?n/F*100:0)]].filter(r=>!['Schulden','Liquidität','Realisierte G/V'].includes(r[0])||r[1]!=='0 €').map(([a,b])=>`<div class="li"><span class="mut">${a}</span><b>${b}</b></div>`).join(''))};
function sankey(l){const cs={},os={};let inv=0;l.forEach(x=>{if(IN.includes(x.c))cs[x.c]=(cs[x.c]||0)+x.a;else if(x.c==='Sparen/Invest')inv+=x.a;else os[x.c]=(os[x.c]||0)+x.a});
const I=Object.entries(cs).sort((a,b)=>b[1]-a[1]),O=Object.entries(os).sort((a,b)=>b[1]-a[1]),si=I.reduce((s,e)=>s+e[1],0),so=O.reduce((s,e)=>s+e[1],0)+inv;
if(!si&&!so)return '<span class="mut">Keine Daten in diesem Monat</span>';
const Lf=I.map(e=>({n:e[0],v:e[1],c:'var(--g)'}));if(so>si)Lf.push({n:'Defizit',v:so-si,c:'#ff4d6d'});
const Rt=O.map(e=>({n:e[0],v:e[1],c:'var(--or)'}));if(inv)Rt.push({n:'Sparen/Invest',v:inv,c:'var(--ink)'});if(si>so)Rt.push({n:'Überschuss',v:si-so,c:'var(--g)'});
const T=Math.max(si,so),g=7,m=Math.max(Lf.length,Rt.length),H=Math.max(170,m*30),k=(H-g*(m-1))/T;
let y=0;Lf.forEach(n=>{n.y=y;n.h=n.v*k;n.u=0;y+=n.h+g});y=0;Rt.forEach(n=>{n.y=y;n.h=n.v*k;n.u=0;y+=n.h+g});
[Lf,Rt].forEach(c=>{let p=-99;c.forEach(n=>{n.ly=Math.max(n.y+n.h/2+3,p+11);p=n.ly})});const xl=100,xr=260;let rb='',nd='';
Lf.forEach(a=>Rt.forEach(b=>{const w=a.v*b.v/T*k,y0=a.y+a.u+w/2,y1=b.y+b.u+w/2;a.u+=w;b.u+=w;rb+=`<path d="M${xl} ${y0}C180 ${y0},180 ${y1},${xr} ${y1}" fill="none" stroke="${b.c}" stroke-opacity=".3" stroke-width="${Math.max(.5,w)}"/>`}));
const lb=(n,x,an)=>`<text x="${x}" y="${n.ly}" font-size="9" text-anchor="${an}" fill="var(--ink)">${esc(n.n.slice(0,10))} ${eur(n.v)}</text>`;
Lf.forEach(n=>nd+=`<rect x="${xl-6}" y="${n.y}" width="6" height="${Math.max(1,n.h)}" fill="${n.c}"/>`+lb(n,xl-10,'end'));
Rt.forEach(n=>nd+=`<rect x="${xr}" y="${n.y}" width="6" height="${Math.max(1,n.h)}" fill="${n.c}"/>`+lb(n,xr+10,'start'));
return `<svg role="img" aria-label="Geldfluss-Diagramm (Sankey): Einnahmen, Ausgaben und Sparen" viewBox="0 0 360 ${Math.max(H,Lf[Lf.length-1].ly+8,Rt[Rt.length-1].ly+8)}">${rb}${nd}</svg>`}
function addTx(){const a=N('ta');if(!(a>0))return;const c=$('tc').value,rid=$('tr').checked?uid():null,nt=clean($('tn').value);S.tx.push({id:uid(),d:$('td').value||mo+'-01',c,a,n:nt,r:rid});if(rid)S.rec.push({id:rid,c,a,n:nt,e:false});save();render()}
/* Historie: je Monat genau ein angezeigter Eintrag. Gewinnt der manuell gesetzte, sonst der zuletzt gespeicherte. */
const histPick=m=>{let p=null;S.hist.forEach(x=>{if(x.m===m&&(!p||!p.man||x.man))p=x});return p},histUniq=()=>[...new Set(S.hist.map(x=>x.m))].map(histPick);
function snap(){if(!S.as.length&&!S.debts.length)return;const m=ymOf(),v=Math.round(nn()),e=histPick(m);if(!e){S.hist.push({id:uid(),m,nw:v});save()}else if(!e.man&&e.nw!==v){e.nw=v;save()}}
function addHist(){const m=$('hm').value,v=parseFloat($('hv').value);if(!m||!isFinite(v))return;const e=histPick(m);if(e){e.nw=v;e.man=1}else S.hist.push({id:uid(),m,nw:v,man:1});save();render()}
const histHTML=()=>{const H=histUniq().sort((a,b)=>a.m.localeCompare(b.m));let h='';
if(H.length>=2){const vs=H.map(x=>x.nw),mn=Math.min(...vs),mx=Math.max(...vs),r=(mx-mn)||1,X=i=>44+306*i/(H.length-1),Y=v=>110-96*(v-mn)/r,lab=v=>Math.abs(v)>=1e6?(v/1e6).toFixed(1).replace('.',',')+' M':Math.round(v/1000)+' T',col=vs[vs.length-1]>=vs[0]?'var(--g)':'var(--or)';
h+=`<svg role="img" aria-label="Verlauf des Nettovermögens" viewBox="0 0 360 140" data-pts="${esc(JSON.stringify(H.map(x=>[x.m,x.nw])))}" data-names="Net Worth" data-x0="44" data-x1="350" data-top="14" data-bot="110" data-min="${mn}" data-max="${mn+r}">`+[0,.5,1].map(q=>{const v=mn+r*q,yy=Y(v);return `<line x1="44" x2="352" y1="${yy}" y2="${yy}" stroke="var(--ln)"/><text x="40" y="${yy+3}" font-size="8" text-anchor="end" fill="var(--mut)">${lab(v)}</text>`}).join('')+`<path d="${H.map((x,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(x.nw).toFixed(1)).join('')}" fill="none" stroke="${col}" stroke-width="2"/>`+H.map((x,i)=>`<circle cx="${X(i)}" cy="${Y(x.nw)}" r="${i===H.length-1?4:2.5}" fill="${col}">${i===H.length-1?ANIM:''}</circle>`).join('')+`<text x="44" y="132" font-size="8" fill="var(--mut)">${esc(H[0].m)}</text><text x="352" y="132" font-size="8" text-anchor="end" fill="var(--mut)">${esc(H[H.length-1].m)}</text></svg>`;
const d=vs[vs.length-1]-vs[0];h+=`<div class="${d>=0?'pos':'neg'}">${d>=0?'+':''}${eur(d)} seit ${esc(H[0].m)}</div>`}
else h+='<span class="mut">Der Verlauf entsteht automatisch: ein Punkt pro Monat. Ältere Stände kannst du unten nachtragen.</span>';
h+=`<div class="row" style="margin-top:10px"><input aria-label="Monat des Stands" id="hm" type="month"><input aria-label="Net Worth in Euro" id="hv" type="number" inputmode="decimal" placeholder="Net Worth €"></div><button class="btn o" ${act('addHist')}>Stand nachtragen</button>`+H.slice(-6).reverse().map(x=>edRow('hist',x,`<div class="li"><span>${esc(x.m)}</span><span>${eur(x.nw)} <button class="btn x" aria-label="Bearbeiten" ${act('edStart',['hist',x.id])}>✎</button> <button class="btn x" aria-label="Löschen" ${act('del',['hist',x.id])}>×</button></span></div>`)).join('');
return P('[Verlauf] Net Worth',h)};
const goalCalc=g=>{const cur=gv(g),gap=g.t-cur;if(gap<=0)return '<div class="pos">✓ Ziel erreicht</div>';const now=new Date(),yN=now.getFullYear(),mI=now.getMonth(),rr=(g.m&&g.m!=='man'&&g.m!=='cash')?S.f.r:0,mr=Math.pow(1+rr/100,1/12)-1,sv=avg().s;let t1='';
if(sv>0){let v=cur,k=0;while(v<g.t&&k<1200){v=v*(1+mr)+sv;k++}t1=' · mit voller Ø-Sparleistung ('+eur(sv)+'/Mon.): '+(k>=1200?'nie':new Date(yN,mI+k,1).toLocaleDateString('de-DE',{month:'2-digit',year:'numeric'}))}
if(!g.y||!(+g.y>=yN))return `<div class="mut">Noch ${eur(gap)} offen${t1}</div>`;
const n=(g.y-yN)*12+(12-mI),f=Math.pow(1+mr,n),need=mr>0?(g.t-cur*f)*mr/(f-1):(g.t-cur)/n;
if(need<=0)return `<div class="pos">Wächst von allein ins Ziel (${pct(rr)} p.a. angenommen)</div>`;
return `<div class="${need>sv?'neg':'pos'}">Nötig: ${eur(need)}/Mon. bis ${g.y}${rr?' (bei '+pct(rr)+' p.a.)':''}</div><div class="mut">Noch ${eur(gap)} offen${t1}</div>`};
let txy='';let lastTab='',ed=null,LIVE={ts:0,list:[],err:''},ltop=5,lsel='bitcoin',dg=null;
const FLD={hist:[['m','Monat (JJJJ-MM)','t'],['nw','Net Worth €','n']],tx:[['c','Kategorie','sel'],['a','Betrag €','n'],['d','Datum','d'],['n','Notiz','t']],as:[['n','Name','t'],['q','Menge','n'],['p','Kurs je Einheit €','n'],['c','Einstand gesamt €','n']],debts:[['n','Name','t'],['a','Betrag €','n'],['r','Zins % p. a. (optional)','o'],['rate','Monatliche Rate € (optional)','o']],goals:[['n','Name','t'],['t','Ziel €','n'],['y','Deadline','t'],['c','Stand € (manuell)','n'],['m','Aktueller Stand','goalmode']],rec:[['c','Kategorie','sel'],['a','Betrag €','n'],['n','Notiz','t']]};
/* Inline-Bearbeitung: ed={k,id} öffnet die Felder in der Zeile des Eintrags (Eingabe-IDs ef0… nach FLD). ed.v hält Eingaben über Zwischen-Renders, ed.m den Umfang einer Position. */
const edKey=(k,id)=>k+':'+id;
let edAuf='';
function edCap(){if(!ed||!$('edrow')||edAuf!==edKey(ed.k,ed.id))return;const v=ed.v||[];FLD[ed.k].forEach((_,i)=>{const e=$('ef'+i);if(e)v[i]=e.value});ed.v=v;const a=document.activeElement,id=a&&a.id?a.id:'';ed.f=/^(ef\d+|emode)$/.test(id)?id:null}
function edFocus(){if(ed&&ed.f&&$(ed.f))$(ed.f).focus()}
const edRow=(k,it,normal)=>{if(!ed||ed.k!==k||ed.id!==it.id)return normal;
const v=ed.v||[],sv=x=>x==null?'':esc(x),as=k==='as',mode=as?(ed.m||(it.m==='e'?'e':'d')):'',nur=as&&mode==='e',lk=as&&mode==='d'&&it.m!=='e'&&!!it.l&&(it.l.length>1||it.l.some(x=>x.f>0));
const raw=(i,f)=>v[i]!==undefined?v[i]:it[f];
const feld=i=>{const[f,l0,t]=FLD[k][i],val=raw(i,f),l=nur&&i===2?'Aktueller Gesamtwert €':l0;
return `<label>${l}</label>`+(t==='sel'?`<select id="ef${i}" aria-label="${l}">${IN.concat(OUT).map(c=>`<option ${c===val?'selected':''}>${c}</option>`).join('')}</select>`:t==='goalmode'?`<select id="ef${i}" aria-label="${l}">${[['man','Manuell'],['nw','Net Worth (aktueller Stand)'],['cash','Cash'],['etf','ETF'],['crypto','Krypto']].map(([o,x])=>`<option value="${o}" ${o===val?'selected':''}>${x}</option>`).join('')}</select>`:`<input id="ef${i}" aria-label="${l}" type="${t==='n'?'number':t==='d'?'date':'text'}" ${t==='n'?'inputmode="decimal" step="any"':t==='o'?'inputmode="decimal"':''} value="${sv(val)}">`)};
const idx=(nur||lk)?[0,2]:FLD[k].map((_,i)=>i);
const umfang=as?`<label>Umfang</label><select id="emode" aria-label="Umfang der Position" ${act('edMode',['$value'],'change')}><option value="d" ${mode==='d'?'selected':''}>Mit Einkaufswerten</option><option value="e" ${mode==='e'?'selected':''}>Nur aktueller Wert</option></select>`:'';
const hin=lk?'<div class="mut">Menge und Einstand kommen aus den Kauf-Lots (mit Datum und Gebühren) und bleiben hier unverändert. Käufe und Verkäufe nach dem Speichern über + Kauf / − Verkauf.</div>':'';
const fehl=k==='debts'?'<div class="neg" id="edfehl" role="alert"></div>':'';
const zug=ed.cg?'Zugeordnet: '+esc(ed.cgn||ed.cg):it.cg?'Zugeordnet: '+esc(it.cg):'Keine CoinGecko-Zuordnung – Coin suchen und wählen, dann Speichern.';
const cgz=as&&it.k==='crypto'?`<div class="cgz"><div class="mut">${zug}</div><input id="ecs" type="search" autocomplete="off" aria-label="Coin suchen (CoinGecko)" placeholder="Coin suchen, z. B. Bitcoin oder BTC" ${act('cgSuch',['$value'],'input')}><div id="ecg"></div></div>`:'';
edAuf=edKey(k,it.id);
return `<div class="li" style="display:block" id="edrow" data-k="${k}" data-id="${esc(it.id)}">${umfang}${idx.map(feld).join('')}${cgz}${hin}${fehl}<div class="acts"><button class="btn" ${act('edSave')}>Speichern</button><button class="btn o" ${act('edClose')}>Abbrechen</button></div></div>`};
/* Position speichern. Nur-Wert: Menge 1, Gesamtwert, ohne Einstand und Lots. Mehrere Käufe oder Kauf mit Gebühren: nur Name und Kurs, Menge, Einstand und Lots bleiben. Sonst wie bisher (ein Kauf ohne Gebühren). */
function edSaveAs(it){const g=i=>{const e=$('ef'+i);return e?e.value:''},num=x=>parseFloat(String(x).replace(',','.'))||0;
const mode=ed.m||(it.m==='e'?'e':'d');it.n=g(0);if(ed.cg)it.cg=ed.cg;
if(mode==='e'){it.m='e';it.q=1;it.p=num(g(2));delete it.c;delete it.l;return}
if(it.m!=='e'&&it.l&&(it.l.length>1||it.l.some(x=>x.f>0))){it.p=num(g(2));return}
const q=num(g(1)),c=num(g(3));it.m='d';it.q=q;it.p=num(g(2));it.c=c;it.l=[{d:(it.l&&it.l[0]&&it.l[0].d)||'',q,p:q?c/q:it.p,f:0}]}
function edSave(){const it=S[ed.k].find(x=>x.id===ed.id);if(!it){ed=null;return render()}
if(ed.k==='as'){edSaveAs(it);ed=null;save();return render()}
const opt={};let fehler='';FLD[ed.k].forEach(([f,l,t],i)=>{if(t!=='o')return;const r=optEingabe($('ef'+i).value,f);if(!r.ok)fehler=fehler||r.msg;else opt[f]=r.v});
if(fehler){$('edfehl').textContent=fehler;return}
FLD[ed.k].forEach(([f,l,t],i)=>{const v=$('ef'+i).value;if(t==='o'){if(opt[f]===undefined)delete it[f];else it[f]=opt[f];return}if((t==='d'&&!v)||(ed.k==='hist'&&f==='m'&&!/^\d{4}-\d{2}$/.test(v)))return;it[f]=t==='n'?(parseFloat(String(v).replace(',','.'))||0):v});
if(ed.k==='hist')it.man=1;ed=null;save();render()}
/* Umschalter „Nur aktueller Wert“: beim Wechsel von „Mit Einkaufswerten“ fragt confirm(), gespeichert wird erst mit „Speichern“. */
function edMode(v){if(!ed||ed.k!=='as')return;const it=S.as.find(x=>x.id===ed.id);if(!it)return;const cur=ed.m||(it.m==='e'?'e':'d');if(v===cur)return;edCap();
if(v==='e'&&it.m!=='e'&&!confirm('Als „Nur aktueller Wert“ werden beim Speichern Menge, Einstand, Gebühren und Kauf-Lots dieser Position entfernt. Nur Name und Gesamtwert bleiben. Fortfahren?'))return render();
const dv=(i,f)=>ed.v&&ed.v[i]!==undefined?ed.v[i]:it[f],num=x=>parseFloat(String(x==null?'':x).replace(',','.'))||0;
ed.v=ed.v||[];if(v==='e')ed.v[2]=String(num(dv(1,'q'))*num(dv(2,'p')));else ed.v[1]=1;
ed.m=v;edAuf='';render()}/* edAuf leer: der Render übernimmt ed.v, nicht die alten DOM-Werte */
const PAL=['#ff5a1f','#222','#5b6cff','#d4a017','#1f9d63','#9b59b6','#ff4d6d','#8a8d93'];
const tv=v=>!isFinite(v)?'–':Math.abs(v)<10?v.toLocaleString('de-DE',{maximumFractionDigits:4}):Math.abs(v)<1000?v.toLocaleString('de-DE',{maximumFractionDigits:2}):Math.round(v).toLocaleString('de-DE');
const pie=(it,ct)=>{it=it.filter(x=>x.v>0);const T=it.reduce((s,x)=>s+x.v,0);if(!T)return '<span class="mut">Keine Daten</span>';const R=60,C=2*Math.PI*R;let o=0;return `<svg role="img" aria-label="Kreisdiagramm: Verteilung nach Anlageart" viewBox="0 0 160 160" style="max-width:200px;margin:auto"><circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--ln)" stroke-width="22"/>${it.map((x,i)=>{const f=x.v/T,s=`<circle cx="80" cy="80" r="${R}" fill="none" stroke="${x.c||PAL[i%PAL.length]}" stroke-width="22" stroke-dasharray="${f*C} ${C}" stroke-dashoffset="${-o*C}" transform="rotate(-90 80 80)"><title>${esc(x.n)}: ${eur(x.v)} (${pct(f*100)})</title></circle>`;o+=f;return s}).join('')}<text x="80" y="84" font-size="11" text-anchor="middle" fill="var(--ink)">${ct||''}</text></svg>`+it.map((x,i)=>`<div class="li"><span><span aria-hidden="true" style="color:${x.c||PAL[i%PAL.length]}">■</span> ${esc(x.n)}</span><span>${pct(x.v/T*100)} · ${eur(x.v)}</span></div>`).join('')};
function ca(s,pts,names,x0,x1,top,bot,mn,mx){s.setAttribute('data-pts',JSON.stringify(pts));s.dataset.names=names.join('|');s.dataset.x0=x0;s.dataset.x1=x1;s.dataset.top=top;s.dataset.bot=bot;s.dataset.min=mn;s.dataset.max=mx}
/* Hinweis-Element des zuletzt gezeigten Diagramms. Nur dieses wird entfernt, ohne das ganze Dokument abzusuchen. */
let tipEl=null;
document.addEventListener('pointermove',e=>{const s=e.target.closest&&e.target.closest('svg[data-pts]');if(tipEl){tipEl.remove();tipEl=null}if(!s||dg||S.hide)return;const R=JSON.parse(s.getAttribute('data-pts')),vb=s.getAttribute('viewBox').split(' ').map(Number),r=s.getBoundingClientRect(),x0=+s.dataset.x0,x1=+s.dataset.x1,fx=(e.clientX-r.left)/(r.width||1)*vb[2],i=Math.max(0,Math.min(R.length-1,Math.round((fx-x0)/(x1-x0)*(R.length-1)))),d=R[i],x=x0+(x1-x0)*i/Math.max(1,R.length-1),mn=+s.dataset.min,mx=+s.dataset.max,top=+s.dataset.top,bot=+s.dataset.bot,y=bot-(bot-top)*(d[1]-mn)/((mx-mn)||1),nm=s.dataset.names.split('|'),L=[d[0]].concat(nm.map((n,k)=>n+': '+tv(d[k+1])+' €')),w=Math.max(...L.map(l=>l.length))*4.7+10,h=L.length*10+6,bx=Math.min(Math.max(x-w/2,2),vb[2]-w-2),g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','tip');
g.innerHTML=`<line x1="${x}" x2="${x}" y1="${top}" y2="${bot}" stroke="var(--or)" stroke-dasharray="2 2"/><circle cx="${x}" cy="${y}" r="3.5" fill="var(--p)" stroke="var(--or)" stroke-width="1.5"/><rect x="${bx}" y="2" width="${w}" height="${h}" fill="var(--p)" stroke="var(--or)" opacity=".95"/>`+L.map((l,k)=>`<text x="${bx+5}" y="${12+k*10}" font-size="8" fill="var(--ink)">${esc(l)}</text>`).join('');s.appendChild(g);tipEl=g});
function lc(rows,names,cols,o){o=o||{};if(rows.length<2)return '<span class="mut">Keine Daten</span>';const st=Math.ceil(rows.length/200);rows=rows.filter((_,i)=>i%st===0||i===rows.length-1);const n=rows.length,vs=rows.flatMap(r=>r.slice(1)),mn=Math.min(...vs),m0=Math.max(...vs),mx=m0===mn?mn+1:m0,X=i=>46+304*i/(n-1),Y=v=>110-96*(v-mn)/(mx-mn),lab=v=>Math.abs(v)>=1e6?(v/1e6).toFixed(1).replace('.',',')+' M':Math.abs(v)>=1e4?Math.round(v/1000)+' T':tv(v);
let g=[0,1,2,3].map(q=>{const v=mn+(mx-mn)*q/3,yy=Y(v);return `<line x1="46" x2="352" y1="${yy}" y2="${yy}" stroke="var(--ln)"/><text x="42" y="${yy+3}" font-size="8" text-anchor="end" fill="var(--mut)">${lab(v)}</text>`}).join('');
names.forEach((_,k)=>{g+=`<path d="${rows.map((r,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(r[k+1]).toFixed(1)).join('')}" fill="none" stroke="${cols[k]}" stroke-width="${k?1.2:2}" ${k&&o.dash?'stroke-dasharray="4 3"':''}/>`});
g+=`<circle cx="${X(n-1)}" cy="${Y(rows[n-1][1])}" r="4" fill="${cols[0]}">${ANIM}</circle><text x="46" y="128" font-size="8" fill="var(--mut)">${rows[0][0]}</text><text x="352" y="128" font-size="8" text-anchor="end" fill="var(--mut)">${rows[n-1][0]}</text>`;
return `<svg role="img" aria-label="Verlauf des Portfoliowerts" viewBox="0 0 360 134" data-pts="${esc(JSON.stringify(rows))}" data-names="${names.join('|')}" data-x0="46" data-x1="350" data-top="14" data-bot="110" data-min="${mn}" data-max="${mx}">${g}</svg>`}
const RG=[['4h',1,4],['12h',1,12],['1T',1,24],['7T',7,168],['30T',30,720],['1J',365,8760],['YTD',0,0]];let lrg='7T',CH={},SELN='';
const rgInfo=()=>{const r=RG.find(x=>x[0]===lrg),n=new Date(),y0=new Date(n.getFullYear(),0,1);return r[0]==='YTD'?{days:365,since:+y0}:{days:r[1],since:Date.now()-r[2]*36e5}};
/* CoinGecko-Verlauf: eine Abfrage nach der anderen, Pause bei Rate-Limit, automatischer Neuversuch, Cache (auch über App-Neustarts) */
const CGQ={q:[],run:0,until:0,tm:null},CG_TTL={1:3*6e4,7:30*6e4,30:3*36e5,365:6*36e5},CG_ZEIT=1e4;
try{const c=JSON.parse(localStorage.getItem('fr_cg')||'{}');Object.keys(c).forEach(k=>{if(c[k]&&Array.isArray(c[k].d)&&Date.now()-c[k].t<864e5)CH[k]=c[k]})}catch(e){/* Beschädigter Verlaufs-Cache: wird ignoriert und neu geladen. */}
let cgSv=null;const cgSave=()=>{clearTimeout(cgSv);cgSv=setTimeout(()=>{const o={};Object.keys(CH).forEach(k=>{if(CH[k]&&CH[k].d)o[k]={d:CH[k].d.map(p=>[p[0],+p[1].toPrecision(7)]),t:CH[k].t}});try{localStorage.setItem('fr_cg',JSON.stringify(o))}catch(e){/* Cache nicht speicherbar: Kurse gelten nur bis zum Neuladen. */}},800)};
/* Abrufe mit 10 s Zeitlimit (AbortController plus Rennen mit Timer): eine hängende Antwort blockiert die Warteschlange nicht. */
function cgJson(url){const ac=typeof AbortController==='function'?new AbortController():{signal:undefined,abort(){}};let t;return Promise.race([(async()=>{const r=await fetch(url,{signal:ac.signal});return{r,j:r.ok?await r.json():null}})(),new Promise((_,rej)=>{t=setTimeout(()=>{ac.abort();rej(new Error('Zeitüberschreitung'))},CG_ZEIT)})]).finally(()=>clearTimeout(t))}
/* Neuzeichnen höchstens alle 400 ms, nie während ein Eingabefeld Fokus hat (danach, sobald das Feld verlassen ist). */
let rqT=null,rqPend=false,rqLast=0;
const eingabeFokus=()=>['INPUT','SELECT','TEXTAREA'].includes(document.activeElement&&document.activeElement.tagName);
function rq(){if(rqT)return;rqT=setTimeout(()=>{rqT=null;if(eingabeFokus()){rqPend=true;return}rqPend=false;rqLast=Date.now();render()},Math.max(0,rqLast+400-Date.now()))}
const cgWake=ms=>{clearTimeout(CGQ.tm);CGQ.tm=setTimeout(()=>{CGQ.tm=null;cgPump();if(tab==='crypto')rq()},Math.max(500,ms))};
function need(id){const{days}=rgInfo(),k=id+':'+days,v=CH[k];if(v&&(v.l||CGQ.q.includes(k)))return;if(v&&v.d&&Date.now()-v.t<(CG_TTL[days]||6e5))return;if(v&&v.next&&Date.now()<v.next)return;CGQ.q.push(k);if(v&&v.e)v.l=1;cgPump()}
async function cgPump(){if(CGQ.run||!CGQ.q.length)return;const w=CGQ.until-Date.now();if(w>0)return cgWake(w);CGQ.run=1;const k=CGQ.q.shift(),[id,days]=k.split(':'),old=CH[k]||{};CH[k]={...old,l:1};let ok=0;
try{try{const{r,j}=await cgJson('https://api.coingecko.com/api/v3/coins/'+encodeURIComponent(id)+'/market_chart?vs_currency=eur&days='+days);
if(r.status===429){const ra=parseInt(r.headers.get('Retry-After'),10),ms=(isFinite(ra)&&ra>0?ra:60)*1e3;CGQ.until=Date.now()+ms;CGQ.q.unshift(k);CH[k]={...old,e:old.d?0:429,next:CGQ.until};delete CH[k].l}
else{if(!r.ok)throw new Error('HTTP '+r.status);if(!Array.isArray(j.prices)||!j.prices.length)throw new Error('leer');CH[k]={d:j.prices,t:Date.now()};ok=1;cgSave()}}
catch(e){CH[k]={...old,e:old.d?0:1,next:Date.now()+2e4};delete CH[k].l}}
finally{CGQ.run=0}
if(tab==='crypto')rq();
if(CGQ.q.length)cgWake(Math.max(CGQ.until-Date.now(),ok?1200:0));else if(Object.values(CH).some(v=>v&&v.e))cgWake(Math.max(...Object.values(CH).filter(v=>v&&v.e).map(v=>v.next))-Date.now())}
const series=id=>{const{days,since}=rgInfo(),v=CH[id+':'+days];need(id);if(v&&Array.isArray(v.d))return v.d.filter(p=>p[0]>=since);if(v&&v.e)return 'err';return undefined};
function cgRetry(){CGQ.until=0;Object.keys(CH).forEach(k=>{if(CH[k]&&CH[k].e)CH[k].next=0});render()}
const cgErrMsg=()=>{const rl=Object.values(CH).some(v=>v&&v.e===429)||CGQ.until>Date.now(),wt=Math.max(0,Math.ceil((Math.max(CGQ.until,...Object.values(CH).filter(v=>v&&v.e).map(v=>v.next||0))-Date.now())/1e3));return `<span class="neg">${rl?'CoinGecko bremst gerade (kostenloses Abruflimit erreicht).':'Verlauf gerade nicht erreichbar (offline oder CoinGecko gestört).'} Neuer Versuch automatisch${wt?' in ca. '+wt+' s':''}.</span> <button class="btn o" style="margin:6px 0 0" ${act('cgRetry')}>Jetzt erneut versuchen</button>`};
const fl=(ts,l)=>new Date(ts).toLocaleString('de-DE',l?{day:'2-digit',month:'2-digit',year:'2-digit'}:{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const rgBtns=()=>`<div class="rng">${RG.map(r=>`<button class="rg ${lrg===r[0]?'on':''}" ${act('setLrg',[r[0]])}>${r[0]}</button>`).join('')}</div>`;
const longR=()=>rgInfo().days>=30;
/* Zuordnung ohne cg-ID: nur bei genau einem Treffer in der Top-Liste (Name, ID oder Symbol exakt). Kein „erster Treffer“. */
const cgTreffer=n=>{const t=String(n||'').trim().toLowerCase();if(!t)return null;const h=LIVE.list.filter(c=>c.id===t||c.name.toLowerCase()===t||c.symbol.toLowerCase()===t);return h.length===1?h[0]:null};
const pfHTML=()=>{const cs=S.as.filter(a=>a.k==='crypto');if(!cs.length)return '';const cid=a=>a.cg||(cgTreffer(a.n)||{}).id,ls=cs.map(a=>({a,id:cid(a)})),ser=ls.filter(l=>l.id).map(l=>({q:l.a.q,s:series(l.id)})),fx=ls.filter(l=>!l.id).reduce((s,l)=>s+val(l.a),0),cost=cs.reduce((s,a)=>s+(a.c||0),0);let b;
if(!ser.length)b='<span class="mut">Für den Verlauf brauche ich Live-Daten: wähle Coins über die Suche (oder nutze Namen wie Bitcoin/BTC).</span>';
else if(ser.some(x=>x.s==='err'))b=cgErrMsg();
else if(ser.some(x=>!Array.isArray(x.s)))b='<span class="mut">Lade Verlauf …</span>';
else{const B=ser[0].s,n=B.length,rows=B.map((p,i)=>[fl(p[0],longR()),fx+ser.reduce((s,x)=>s+x.q*x.s[Math.round(i/Math.max(1,n-1)*(x.s.length-1))][1],0),cost]),a=rows[0][1],z=rows[n-1][1],gv=z-cost;b=`<div class="k"><b class="${gv>=0?'pos':'neg'}">${gv>=0?'+':''}${eur(gv)}</b><span>G/V gesamt · im Zeitraum ${z>=a?'+':''}${pct((z/a-1)*100)}</span></div>`+lc(rows,['Wert','Einstand'],[z>=cost?'var(--g)':'var(--or)','var(--ink)'],{dash:1})+'<div class="note">Verlauf = aktuelle Mengen × historische Kurse; Einstand = deine Ø-Kaufpreise (gestrichelt). Tippen/Ziehen im Chart zeigt Zeit und Werte.</div>'}
return P('[Verlauf] Krypto-Portfolio',rgBtns()+b)};
const liveHTML=()=>{const L=LIVE.list.slice(0,ltop),b=n=>`<button class="btn ${ltop===n?'':'o'}" style="margin:0" ${act('setLtop',[n])}>Top ${n}</button>`;let h=`<div class="row">${b(5)}${b(10)}<button class="btn o" style="margin:0" ${act('liveNeu')}>↻ Aktualisieren</button></div>`;
if(!L.length)return P('[Live] Top Kurse',h+`<div class="note">${esc(LIVE.err)||'Lade Kurse …'}</div>`);
const cur=LIVE.list.find(c=>c.id===lsel)||L[0],s=series(cur.id),p24=cur.price_change_percentage_24h||0;
h+=`<div class="mut" style="margin-top:10px">${esc(cur.name)} · <span class="live pulse" style="display:inline-block"></span> Stand ${new Date(LIVE.ts).toLocaleTimeString('de-DE')}</div><div class="k big"><b>${cur.current_price.toLocaleString('de-DE',{maximumFractionDigits:cur.current_price<10?4:2})} €</b></div>`+rgBtns();
if(Array.isArray(s)&&s.length>1){const a=s[0][1],z=s[s.length-1][1],hi=Math.max(...s.map(x=>x[1])),lo=Math.min(...s.map(x=>x[1]));h+=`<div class="${z>=a?'pos':'neg'}">${z>=a?'+':''}${pct((z/a-1)*100)} im Zeitraum · Hoch ${tv(hi)} € · Tief ${tv(lo)} €</div>`+lc(s.map(x=>[fl(x[0],longR()),x[1]]),['Preis'],[z>=a?'var(--g)':'var(--or)'])}
else h+=s==='err'?'<div>'+cgErrMsg()+'</div>':'<div class="mut">Lade Verlauf …</div>';
h+=L.map(c=>{const p=c.price_change_percentage_24h||0;return `<div class="li" ${act('setLsel',[c.id.replace(/[^\w-]/g,'')])} style="cursor:pointer"><span>${c.market_cap_rank}. ${esc(c.symbol.toUpperCase())}<small>${esc(c.name)}</small></span>${spark(c.sparkline_in_7d.price,70,22,p>=0?'var(--g)':'var(--or)')}<span>${c.current_price.toLocaleString('de-DE',{maximumFractionDigits:c.current_price<10?4:2})} €<small class="${p>=0?'pos':'neg'}">${p>=0?'+':''}${p.toFixed(2).replace('.',',')} % (24h)</small></span></div>`}).join('')+`<div class="note">Quelle: CoinGecko (EUR), Kurse jede Minute. Coins im Portfolio werden automatisch live bewertet.</div>`;return P('[Live] Top '+ltop+' Krypto',h)};
const fixk=()=>S.rec.filter(r=>!IN.includes(r.c)&&r.c!=='Sparen/Invest').reduce((s,r)=>s+r.a,0)||avg().o;
const egCore=()=>{const have=S.as.filter(a=>a.eg).reduce((s,a)=>s+val(a),0),fk=fixk(),m=S.f.egm||3,t=S.f.egt>0?S.f.egt:fk*m,pc=t?Math.min(100,have/t*100):0;return `<div class="k"><b class="${have>=t&&t>0?'pos':'neg p'}">${eur(have)}</b><span>von ${eur(t)} Ziel · reicht für ${fk?(have/fk).toFixed(1).replace('.',','):'–'} Monate</span></div><div class="bar"><i style="width:${pc}%"></i></div><div class="mut">Fixkosten ${eur(fk)}/Monat</div>`};
const egHTML=()=>P('[Notgroschen]',egCore()+`<div class="row"><div><label>Ziel in Monaten</label><input type="number" step="0.5" aria-label="Ziel in Monaten" value="${S.f.egm||3}" ${act('setEgm',['$value'],'change')}></div><div><label>Oder fester Betrag €</label><input type="number" aria-label="Oder fester Betrag in Euro" value="${S.f.egt||''}" placeholder="auto" ${act('setEgt',['$value'],'change')}></div></div><div class="note">Fixkosten = Summe deiner wiederkehrenden Ausgaben (sonst Ø Ausgaben). ${S.as.some(a=>a.eg)?'':'Markiere unten bei einem Cash-Konto „Als Notgroschen“.'}</div>`);
function togEg(id){const a=S.as.find(x=>x.id===id);if(a){a.eg=!a.eg;save();render()}}
function tg(id){S.ui.c[id]=!S.ui.c[id];save();render()}
/* Aktionen aus den Ansichten (act() in den Vorlagen). Mehrere Anweisungen stehen hier, nicht im Attribut. */
function kfZeigen(){kfOpen=true;render()}
function goTab(k){if(k!==tab)ed=null;tab=k;render();scrollTo(0,0);if(k==='crypto'&&!LIVE.spk)liveFetch()}
function edStart(k,id){ed={k,id};render();const r=$('edrow');if(r&&r.scrollIntoView)r.scrollIntoView({block:'nearest'});const f=$('ef0');if(f)f.focus()}
function edClose(){ed=null;render()}
function setLrg(v){lrg=v;render()}
function setLtop(n){ltop=n;render()}
function liveNeu(){return liveFetch().then(render)}
function setLsel(id){lsel=id;render()}
function setEgm(v){S.f.egm=+v||3;save();render()}
function setEgt(v){S.f.egt=+v||0;save();render()}
function trdStart(id,m){trd={id,m};render();scrollTo(0,0)}
function trdClose(){trd=null;render()}
function setFNum(k,v){S.f[k]=+v;save();render()}
function setTxy(v){txy=v;render()}
function setYr(v){yr=v;render()}
function pushNun(){return push().then(render)}
function logoutLokal(){if(confirm('Lokale Daten auf diesem Gerät löschen? Cloud-Daten bleiben erhalten.'))logout(true)}
function ordP(){const o=S.ui.o[tab];if(!o)return;const v=$('v'),ps=[...v.children].filter(x=>x.dataset&&x.dataset.pk),kn=ps.filter(x=>o.includes(x.dataset.pk)),sl=kn.map(x=>ps.indexOf(x)),so=kn.slice().sort((a,b)=>o.indexOf(a.dataset.pk)-o.indexOf(b.dataset.pk)),ref=ps.slice(),an=ps.length?ps[ps.length-1].nextSibling:null;sl.forEach((s,i)=>ref[s]=so[i]);ref.forEach(x=>v.insertBefore(x,an))}
/* Vertrauensgrenze: Marktdaten von CoinGecko. Nur Einträge mit Text-ID, Name, Symbol und endlichem Preis; fehlende Verläufe werden leer ersetzt. */
const cgClean=list=>(Array.isArray(list)?list:[]).filter(c=>c&&typeof c.id==='string'&&typeof c.name==='string'&&typeof c.symbol==='string'&&Number.isFinite(c.current_price)).map(c=>({...c,market_cap_rank:c.market_cap_rank??'–',sparkline_in_7d:c.sparkline_in_7d&&Array.isArray(c.sparkline_in_7d.price)?c.sparkline_in_7d:{price:[]}}));
const cgFehler=e=>'Kurse gerade nicht erreichbar – letzter Stand: '+(LIVE.ts?new Date(LIVE.ts).toLocaleTimeString('de-DE'):'unbekannt')+(/^HTTP /.test(e&&e.message)?' ('+e.message+')':'')+'.';
/* Top-Liste (20 Coins, Verlauf der Sparkline nur auf dem Krypto-Tab) und Kurse der Positionen mit cg-ID in einem Aufruf von /simple/price. „Nur aktueller Wert“ wird nie überschrieben. */
async function liveFetch(){if(CGQ.until>Date.now())return;const spk=tab==='crypto';
try{const{r,j}=await cgJson('https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h'+(spk?'&sparkline=true':''));
if(r.status===429){CGQ.until=Date.now()+6e4;cgWake(6e4)}
if(!r.ok)throw new Error('HTTP '+r.status);
LIVE.list=cgClean(j);LIVE.ts=Date.now();LIVE.err='';if(spk)LIVE.spk=true;let ch=0;
const ids=[...new Set(S.as.filter(a=>a.k==='crypto'&&a.m!=='e'&&a.cg).map(a=>a.cg))];
if(ids.length){try{const{r:r2,j:j2}=await cgJson('https://api.coingecko.com/api/v3/simple/price?ids='+ids.map(encodeURIComponent).join(',')+'&vs_currencies=eur&include_24hr_change=true');if(!r2.ok)throw new Error('HTTP '+r2.status);
S.as.forEach(a=>{const p=a.k==='crypto'&&a.m!=='e'&&a.cg&&j2[a.cg]?j2[a.cg].eur:undefined;if(Number.isFinite(p)){a.p=p;ch=1}})}
catch(e){LIVE.err=cgFehler(e)}}
S.as.forEach(a=>{if(a.k!=='crypto'||a.m==='e'||a.cg)return;const c=cgTreffer(a.n);if(c){a.p=c.current_price;ch=1}});
if(ch)save()}
catch(e){LIVE.err=cgFehler(e)}
if(['crypto','assets','port'].includes(tab))rq()}
const spark=(a,w,h,c)=>{if(!a||a.length<2)return '';const s=a.filter((_,i)=>i%4===0);if(s.length<2)return '';const mn=Math.min(...s),mx=Math.max(...s),d=s.map((v,i)=>(i?'L':'M')+(i/(s.length-1)*w).toFixed(1)+' '+(h-(v-mn)/((mx-mn)||1)*h).toFixed(1)).join('');return `<svg aria-hidden="true" viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px"><path d="${d}" fill="none" stroke="${c}" stroke-width="1.5"/></svg>`};
document.addEventListener('pointerdown',e=>{const h=e.target.closest&&e.target.closest('.hd');if(!h)return;const pn=h.dataset.pn,r=pn?h.closest('[data-pk]'):h.closest('[data-id]');if(!r)return;dg={r,k:pn?'__p':r.dataset.k};r.style.opacity='.5';e.preventDefault()});
document.addEventListener('pointermove',e=>{if(!dg)return;e.preventDefault();const t=document.elementFromPoint(e.clientX,e.clientY),o=t&&t.closest(dg.k==='__p'?'[data-pk]':'[data-id]');if(o&&o!==dg.r&&(dg.k==='__p'||o.dataset.k===dg.k)&&o.parentNode===dg.r.parentNode){const b=o.getBoundingClientRect();o.parentNode.insertBefore(dg.r,e.clientY<b.top+b.height/2?o:o.nextSibling)}},{passive:false});
document.addEventListener('pointerup',()=>{if(!dg)return;const{r,k}=dg;dg=null;r.style.opacity='';if(k==='__p'){S.ui.o[tab]=[...$('v').children].filter(x=>x.dataset&&x.dataset.pk).map(x=>x.dataset.pk);save();return}const ids=[...r.parentNode.children].filter(x=>x.dataset&&x.dataset.k===k).map(x=>x.dataset.id),idx=S[k].map((x,i)=>ids.includes(x.id)?i:-1).filter(i=>i>=0),arr=ids.map(id=>S[k].find(x=>x.id===id));idx.forEach((i,j)=>S[k][i]=arr[j]);save();render()});
const liveAktiv=()=>tab==='crypto'||(['home','assets','port'].includes(tab)&&S.as.some(a=>a.k==='crypto'));
liveFetch();setInterval(()=>{if(!document.hidden&&liveAktiv())liveFetch()},18e4);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-LIVE.ts>6e4&&liveAktiv())liveFetch()});
document.addEventListener('focusout',()=>{if(rqPend)setTimeout(()=>{if(!eingabeFokus())rq()},0)});
const lots=a=>{if(!a.l)a.l=[{d:'',q:a.q,p:a.c?a.c/a.q:a.p,f:0}]},recalc=a=>{a.q=a.l.reduce((s,x)=>s+x.q,0);a.c=a.l.reduce((s,x)=>s+x.q*x.p+x.f,0)};
let trd=null;
const hf=a=>{if((a.k!=='crypto'&&a.k!=='gold')||!a.l)return '';const late=a.l.filter(x=>!x.d||!heldMore1Y(x.d));if(!late.length)return a.l.some(x=>x.d)?'· steuerfrei (>1 J.)':'';const ends=late.filter(x=>x.d).map(x=>{const[y,m,d]=x.d.split('-').map(Number);return new Date(y+1,m-1,d)});const bis=ends.length?' bis '+new Date(Math.max(...ends)).toLocaleDateString('de-DE'):'';return `· ${late.reduce((s,x)=>s+x.q,0).toLocaleString('de-DE')} Einh. in Haltefrist${bis}`};
const assetRow=a=>{const sim=a.m==='e',c=a.c||0,g=val(a)-c,ac=a.q?c/a.q:0,u=a.k==='gold'?' g':'',hc=a.k!=='cash'&&c>0,ohne=a.k!=='cash'&&!(c>0),ohneCg=a.k==='crypto'&&a.m!=='e'&&!a.cg&&LIVE.list.length>0&&!cgTreffer(a.n);return edRow('as',a,`<div class="li" style="display:block" data-k="as" data-id="${a.id}"><div style="display:flex;justify-content:space-between"><span><span class="hd">⠿</span>${esc(a.n)}</span><b>${eur(val(a))}</b></div><div class="mut" style="margin:3px 0">${sim?'Nur aktueller Wert':`${a.q.toLocaleString('de-DE')}${u} × ${eur(a.p)}${hc?` · Ø Kauf ${ac.toLocaleString('de-DE',{maximumFractionDigits:2})} €`:''}`}</div>${hc?`<div class="${g>=0?'pos':'neg'}">${g>=0?'+':''}${eur(g)} · ${pct(g/c*100)} ${hf(a)}</div>`:''}${ohne?'<div class="mut">G/V und Rendite: – (kein Einstand erfasst)</div>':''}${ohneCg?'<div class="mut">Keine CoinGecko-Zuordnung – tippe ✎ und wähle den Coin</div>':''}<div class="acts">${a.k==='cash'?`<button class="ac eg${a.eg?' on':''}" ${act('togEg',[a.id])}>${a.eg?'✓ Notgroschen':'Als Notgroschen'}</button>`:''}${sim?'':`<button class="ac" ${act('trdStart',[a.id,'b'])}>+ Kauf</button><button class="ac" ${act('trdStart',[a.id,'s'])}>− Verkauf</button>`}<button class="ac i" aria-label="Bearbeiten" ${act('edStart',['as',a.id])}>✎</button><button class="ac i" aria-label="Löschen" ${act('del',['as',a.id])}>×</button></div></div>`)};
const trHTML=()=>{if(!trd)return '';const a=S.as.find(x=>x.id===trd.id);if(!a||a.m==='e')return '';return P(`[${trd.m==='b'?'Nachkauf':'Verkauf'}] ${esc(a.n)}`,`<div class="row"><div><label>Menge</label><input aria-label="Menge" id="tq" type="number" inputmode="decimal"></div><div><label>Preis je Einheit €</label><input aria-label="Preis je Einheit in Euro" id="tp2" type="number" inputmode="decimal" value="${a.p}"></div></div><div class="row"><div><label>Gebühren €</label><input aria-label="Gebühren in Euro" id="tf2" type="number" inputmode="decimal" value="0"></div><div><label>Datum</label><input aria-label="Datum" id="td2" type="date"></div></div><button class="btn" ${act('doTr')}>Buchen</button><button class="btn o" ${act('trdClose')}>Abbrechen</button>`)};
function doTr(){const a=S.as.find(x=>x.id===trd.id),q=N('tq'),p=N('tp2'),f=N('tf2'),d=$('td2').value;if(!a||a.m==='e'||!(q>0))return;lots(a);
if(trd.m==='b')a.l.push({d,q,p,f});else{if(q>a.q+1e-9){alert('Mehr als vorhanden');return}let r=q,cost=0,gc=0,gp=0;const sd=d||ymdOf();for(const x of a.l){if(r<=1e-12)break;const t=Math.min(x.q,r),fr=t/x.q,cs=t*x.p+x.f*fr,gl=p*t-f*(t/q)-cs;cost+=cs;if(a.k==='crypto'||a.k==='gold'){if(!(x.d&&heldMore1Y(x.d,sd)))gp+=gl}else if(a.k==='etf')gc+=gl*ETF_STEUERANTEIL;else if(a.k==='aktie')gc+=gl;x.f-=x.f*fr;x.q-=t;r-=t}a.l=a.l.filter(x=>x.q>1e-12);const gn=p*q-f-cost;S.real=(S.real||0)+gn;S.sales.push({id:uid(),d:sd,n:a.n,k:a.k,g:gn,gc,gp})}
a.p=p;recalc(a);S.as=S.as.filter(x=>x.q>1e-12);trd=null;save();render()}
let sgT=null,SEL=null,SG=[];
async function cgPrice(id){const l=LIVE.list.find(x=>x.id===id);if(l)return l.current_price;try{const{r,j}=await cgJson('https://api.coingecko.com/api/v3/simple/price?ids='+encodeURIComponent(id)+'&vs_currencies=eur');return r.ok&&j[id]&&j[id].eur}catch(e){return null}}
/* Suche /search mit 5 min Cache je Suchbegriff. */
const CG_SCH={};
async function cgSearch(q){const k=q.toLowerCase(),h=CG_SCH[k];if(h&&Date.now()-h.t<3e5)return h.c;const{r,j}=await cgJson('https://api.coingecko.com/api/v3/search?query='+encodeURIComponent(q));if(!r.ok)throw new Error('HTTP '+r.status);const c=(Array.isArray(j.coins)?j.coins:[]).slice(0,8).map(x=>({id:x.id,n:x.name,s:x.symbol,p:null}));CG_SCH[k]={t:Date.now(),c};return c}
/* Inline-Suche einer Krypto-Position: setzt nur die CoinGecko-ID. Menge, Kurs und Einstand bleiben unverändert. */
let ecT=null,ECG=[];
function cgSuch(q){clearTimeout(ecT);q=String(q||'').trim();ECG=[];const b=$('ecg');if(!b)return;b.innerHTML='';if(q.length<2)return;ecT=setTimeout(async()=>{let c=null;try{c=await cgSearch(q)}catch(e){c=null}const bx=$('ecg'),inp=$('ecs');if(!bx||!inp||inp.value.trim()!==q)return;ECG=c||[];bx.innerHTML=!c?'<div class="neg">Suche gerade nicht erreichbar.</div>':c.length?c.map((x,i)=>`<button class="btn o" style="margin:4px 0;text-align:left" ${act('cgPick',[i])}>${esc(x.n)} (${esc(String(x.s).toUpperCase())})</button>`).join(''):'<div class="mut">Kein Treffer.</div>'},350)}
function cgPick(i){const c=ECG[i];if(!c||!ed||ed.k!=='as')return;ed.cg=c.id;ed.cgn=c.n;render()}
function drawSg(l){SG=l;$('sg').innerHTML=l.map((c,i)=>`<button class="btn o" style="margin:4px 0;text-align:left" ${act('pick',[i])}>${esc(c.n)} (${esc(String(c.s).toUpperCase())})${c.p?' · '+c.p.toLocaleString('de-DE')+' €':''}</button>`).join('')}
function sugg(){const box=$('sg');if(!box)return;SEL=null;clearTimeout(sgT);const q=$('an').value.trim().toLowerCase();if($('ak').value!=='crypto'||!q){box.innerHTML='';SG=[];return}
const loc=LIVE.list.filter(c=>c.symbol.includes(q)||c.name.toLowerCase().includes(q)).sort((a,b)=>(b.symbol===q)-(a.symbol===q)).slice(0,6).map(c=>({id:c.id,n:c.name,s:c.symbol,p:c.current_price}));drawSg(loc);
sgT=setTimeout(async()=>{try{const have=new Set(loc.map(x=>x.id)),extra=await cgSearch(q);if($('an')&&$('an').value.trim().toLowerCase()===q&&!SEL)drawSg(loc.concat(extra.filter(c=>!have.has(c.id)).slice(0,6)).slice(0,8))}catch(e){if($('sg')&&!SG.length)$('sg').innerHTML='<div class="note">Live-Suche nicht erreichbar: Name und Kurs bitte manuell eintragen.</div>'}},350)}
async function pick(i){const c=SG[i];if(!c)return;SEL=c.id;SELN=c.n;$('an').value=c.n;if($('am')&&$('am').value==='e'){$('sg').innerHTML='<div class="pos">✓ '+esc(c.n)+' zugeordnet. Gesamtwert unverändert.</div>';return}$('sg').innerHTML='<div class="pos">✓ '+esc(c.n)+' gewählt, Kurs wird geladen …</div>';const p=c.p||await cgPrice(c.id);if(p){$('ap').value=p;$('sg').innerHTML='<div class="pos">✓ '+esc(c.n)+' · aktueller Kurs '+p.toLocaleString('de-DE')+' € übernommen</div>'}else $('sg').innerHTML='<div class="neg">Kurs nicht abrufbar, bitte manuell eintragen.</div>'}
function setAm(v){const e=v==='e';['amq','amd','amdt'].forEach(i=>{const x=$(i);if(x)x.style.display=e?'none':''});const l=$('apl');if(l)l.textContent=e?'Aktueller Gesamtwert €':'Aktueller Kurs je Einheit €'}
function addAs(){const simple=!!$('am')&&$('am').value==='e',q=simple?1:N('aq'),n=clean($('an').value),fee=simple?0:N('af'),d=simple?'':$('ad').value,k=$('ak').value;let p=N('ap'),cg=(SEL&&clean(SELN)===n.trim())?SEL:'';if(k==='crypto'&&!cg){const c=cgTreffer(n);if(c){cg=c.id;if(!p&&!simple)p=c.current_price}}
const bp=$('ab').value===''?p:N('ab');if(!n||!(q>0)||!(p>=0))return;if(simple)S.as.push({id:uid(),k,n,q,p,m:'e',cg,eg:k==='cash'&&$('ae').checked});else S.as.push({id:uid(),k,n,q,p,c:q*bp+fee,l:[{d,q,p:bp,f:fee}],cg,eg:k==='cash'&&$('ae').checked});SEL=null;save();render()}
function addGoal(){const t=N('gt'),n=clean($('gn').value);if(!n||!(t>0))return;S.goals.push({id:uid(),n,t,c:N('gc'),y:$('gy').value,m:$('gm').value});save();render()}
function setF(){S.f={...S.f,wr:N('fw')||DEFAULT_WR_PCT,exp:$('fe').value,r:N('fr'),fireTarget:Math.max(0,N('ft'))};save();render()}
function simYears(v,sr,r,F){const m=Math.pow(1+r/100,1/12)-1;for(let k=0;k<=960;k++){if(v>=F)return k/12;v=v*(1+m)+sr}return null}
function importBackup(){
try{const raw=$('bk').value;if(!raw.trim())throw new Error('Bitte zuerst eine Backup-Datei als JSON einfügen.');if(raw.length>2000000)throw new Error('Das Backup ist größer als 2 MB. Bitte prüfe die Datei.');if(!confirm('Das aktuelle Finanz-Radar wird durch den importierten Datenstand ersetzt. Vorher am besten exportieren. Fortfahren?'))return;const parsed=JSON.parse(raw),rep=importBericht();S=normalizeImportedState(parsed,rep);save();render();alert('Import erfolgreich. '+importText(rep)+' Prüfe die Daten bitte kurz, bevor du weiterarbeitest.')}catch(e){alert('Import fehlgeschlagen: '+(e&&e.message?e.message:'Ungültige Daten.'))}
}
function importBericht(){return {uebernommen:0,verworfen:{},korrigiert:{}}}
function importText(r){const v=Object.entries(r.verworfen),k=Object.entries(r.korrigiert),nv=v.reduce((s,[,n])=>s+n,0),liste=x=>x.map(([g,n])=>n+' × '+g).join('; ');return r.uebernommen+' übernommen, '+nv+' verworfen'+(v.length?' ('+liste(v)+')':'')+'.'+(k.length?' Korrigiert: '+liste(k)+'.':'')}
let fq='',fcat='';
function feedList(){return mt().sort((a,b)=>b.d.localeCompare(a.d)).filter(x=>(!fcat||x.c===fcat)&&(!fq||(x.c+' '+(x.n||'')+' '+x.a+' '+x.d).toLowerCase().includes(fq)))}
function feedBar(){const cs=[...new Set(mt().map(x=>x.c))].sort();return `<div class="row"><input aria-label="Buchungen durchsuchen" id="fq" type="search" placeholder="Suchen: Notiz, Betrag, Kategorie" value="${esc(fq)}" ${act('feedUpd',[],'input')}><select aria-label="Kategorie filtern" id="fcat" ${act('feedUpd',[],'change')}><option value="">Alle</option>${cs.map(c=>`<option${c===fcat?' selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="mut" id="fcnt" style="margin-top:6px">${feedList().length} Buchungen</div>`}
function feedUpd(){fq=($('fq').value||'').trim().toLowerCase();fcat=$('fcat').value;const l=feedList();$('fdr').innerHTML=feedHTML(l)||'<span class="mut">Keine Treffer</span>';$('fcnt').textContent=l.length+' Buchungen'+(fq||fcat?' (gefiltert)':'');blurNums()}
/* S-18: Die Nutzerkennung (S.uid) gehört nicht in eine Datei. Alle Exporte nutzen diese Funktion. */
function exportJson(){const{uid:_nutzer,...rest}=S;return JSON.stringify(rest)}
function exportBackup(){$('bk').value=exportJson();try{localStorage.setItem('fr_exp',String(Date.now()))}catch(e){/* Zeitstempel der Datei-Sicherung nicht speicherbar: der Hinweis kommt früher wieder. */}}
function msNote(m){const c=(S.msn&&S.msn[m])||'',t=prompt('Notiz zu '+eur(m)+' (leer = löschen)',c);if(t===null)return;S.msn=S.msn||{};const v=clean(t).trim().slice(0,120);if(v)S.msn[m]=v;else delete S.msn[m];save();render()}
function feedHTML(l){const g={};l.forEach(x=>(g[x.c]=g[x.c]||[]).push(x));const row=x=>{const v=IN.includes(x.c)?x.a:-x.a;return edRow('tx',x,`<div class="li"><span>${esc(x.c)}<small>${esc(x.d.slice(8))}.${esc(x.d.slice(5,7))}. ${esc(x.n)}</small></span><span class="${v>=0?'pos':'neg'}">${v>=0?'+':'−'}${eur(Math.abs(x.a))} <button class="btn x" aria-label="Bearbeiten" ${act('edStart',['tx',x.id])}>✎</button> <button class="btn x" aria-label="Löschen" ${act('del',['tx',x.id])}>×</button></span></div>`)};return Object.entries(g).map(([c,r])=>[c,r,r.reduce((s,x)=>s+x.a,0)]).sort((p,q)=>q[2]-p[2]).map(([c,r,t])=>`<div class="mut" style="display:flex;justify-content:space-between;margin-top:10px"><span>${esc(c)}</span><span>${eur(t)}</span></div>`+r.slice().sort((p,q)=>q.a-p.a).map(row).join('')).join('')}
const V={
home(){const n=nw(),l=mt(),i=sm(l,'in'),o=sm(l,'out'),q=i?invSum(l)/i*100:null;
const st=Object.keys(KIND).filter(k=>byK(k)>0).map(k=>`<i class="s-${k}" style="width:${n?byK(k)/n*100:0}%;background:${COL[k]}"></i>`).join('');
return P('[Übersicht] Net Worth',`<div class="k big"><b>${eur(nn())}</b><span>Net Worth (Assets − Schulden)</span></div>${pie(Object.keys(KIND).filter(k=>byK(k)>0).map(k=>({n:KIND[k],v:byK(k),c:COL[k]})),eur(nw()))}`+'')
+histHTML()+P('[Monat] '+mo,`<div class="g2"><div class="k"><b class="pos">${eur(i)}</b><span>Einnahmen</span></div><div class="k"><b class="neg">${eur(o)}</b><span>Ausgaben</span></div><div class="k"><b>${eur(i-o)}</b><span>Cashflow</span></div><div class="k"><b>${q==null?'–':pct(q)}</b><span>Sparquote</span></div></div>`)
+P('[Check] Notgroschen',egCore()+(S.as.some(a=>a.eg)?'':'<div class="note">Markiere unter Vermögen ein Cash-Konto als Notgroschen.</div>'))},
cash(){const l=mt().sort((a,b)=>b.d.localeCompare(a.d));
return P('[Zeitraum]',moNav()+'<div class="row" style="margin-top:10px"><button class="btn o" style="margin:0" '+act('applyRec')+'>Vorlagen anwenden</button><button class="btn o" style="margin:0" '+act('copyMo')+'>Monat übernehmen</button></div>')+P('[Neu] Buchung',`<div class="row"><select aria-label="Kategorie" id="tc">${IN.map(c=>`<option>${c}</option>`).join('')}${OUT.map(c=>`<option>${c}</option>`).join('')}</select><input aria-label="Betrag in Euro" id="ta" type="number" inputmode="decimal" placeholder="Betrag €"></div><div class="row" style="margin-top:8px"><input aria-label="Datum" id="td" type="date" value="${mo===ymOf()?ymdOf():mo+'-01'}"><input aria-label="Notiz" id="tn" placeholder="Notiz"></div><div class="row" style="margin-top:8px;align-items:center"><label style="margin:0"><input aria-label="Wiederkehrend" type="checkbox" id="tr" style="width:auto"> wiederkehrend</label></div><button class="btn" ${act('addTx')}>Buchen</button>`)
+P('[Sankey] Geldfluss',sankey(l))+P('[Mix] Ausgaben',pie(Object.entries(l.filter(x=>!IN.includes(x.c)&&x.c!=='Sparen/Invest').reduce((o,x)=>(o[x.c]=(o[x.c]||0)+x.a,o),{})).map(([n,v])=>({n,v})),eur(sm(l,'out'))))+P('[Einnahmen] '+eur(sm(l,'in')),bars(l,'in'))+P('[Ausgaben] '+eur(sm(l,'out')),bars(l,'out'))
+P('[Wiederkehrend] Vorlagen',S.rec.map(r=>edRow('rec',r,`<div class="li" data-k="rec" data-id="${r.id}"><span><span class="hd">⠿</span>${esc(r.c)}<small>${esc(r.n)}${r.e?' · Notgroschen':''}</small></span><span>${eur(r.a)} <button class="btn x" aria-label="Bearbeiten" ${act('edStart',['rec',r.id])}>✎</button> <button class="btn x" aria-label="Löschen" ${act('del',['rec',r.id])}>×</button></span></div>`)).join('')||'<span class="mut">Keine Vorlagen. Beim Buchen „wiederkehrend“ anhaken.</span>')+P('[Feed] Buchungen',feedBar()+'<div id="fdr">'+(feedHTML(feedList())||'<span class="mut">Keine Buchungen</span>')+'</div>')},
assets(){return trHTML()+egHTML()+P('[Verteilung]',pie(Object.keys(KIND).filter(k=>byK(k)>0).map(k=>({n:KIND[k],v:byK(k),c:COL[k]})),eur(nw())))+P('[Neu] Bestand',`<select aria-label="Art des Bestands" id="ak" ${act('sugg',[],'change')}>${Object.entries(KIND).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><label>Name (bei Krypto: Suche z. B. Bitcoin, ETH, Solana)</label><input aria-label="Name des Bestands" id="an" ${act('sugg',[],'input')} autocomplete="off"><div id="sg"></div><label>Umfang</label><select aria-label="Umfang der Position" id="am" ${act('setAm',['$value'],'change')}><option value="d">Mit Einkaufswerten</option><option value="e">Nur aktueller Wert</option></select><div class="row"><div id="amq"><label>Menge</label><input aria-label="Menge" id="aq" type="number" inputmode="decimal" value="1"></div><div><label id="apl">Aktueller Kurs je Einheit €</label><input aria-label="Aktueller Kurs je Einheit in Euro" id="ap" type="number" inputmode="decimal"></div></div><div class="row" id="amd"><div><label>Ø Kaufpreis je Einheit € (dein Einstand)</label><input aria-label="Ø Kaufpreis je Einheit in Euro" id="ab" type="number" inputmode="decimal" placeholder="was du bezahlt hast"></div><div><label>Gebühren €</label><input aria-label="Gebühren in Euro" id="af" type="number" inputmode="decimal" value="0"></div></div><div id="amdt"><label>Kaufdatum (optional)</label><input aria-label="Kaufdatum" id="ad" type="date"></div><label class="mut" style="display:flex;gap:8px;align-items:center;text-transform:none"><input aria-label="Als Notgroschen markieren" type="checkbox" id="ae" style="width:auto"> Als Notgroschen markieren (nur Cash)</label><button class="btn" ${act('addAs')}>Hinzufügen</button><div class="note">Umfang „Nur aktueller Wert“: nur Name und Gesamtwert. Ohne Einstand gibt es keine G/V und keine Steuerschätzung. Ø Kaufpreis = was du im Schnitt bezahlt hast (nicht der aktuelle Kurs). Leer gelassen gilt der heutige Kurs als Einstand, G/V startet dann bei 0. Bei Krypto trägt die Suche den aktuellen Kurs automatisch ein. Cash: Menge 1, Preis = Betrag. Gold: Menge in Gramm, Preis je Gramm. Später je Position + Kauf / − Verkauf: der Ø-Kaufpreis wird automatisch gemittelt, Verkäufe nach FIFO. Haltefrist-Hinweis (1 Jahr) nur grobe Orientierung, keine Steuerberatung.</div>`)
+Object.keys(KIND).filter(k=>S.as.some(a=>a.k===k)).map(k=>P(`[${KIND[k]}] ${eur(byK(k))}`,S.as.filter(a=>a.k===k).map(assetRow).join(''))).join('')+debtsHTML()+kzHTML()},
fire(){const a=avg(),exp=ausgabenBasis().wert,F=fireF(),autoF=exp*12/(wrOf()/100),n=nn(),pc=F?Math.min(100,n/F*100):0,y=simYears(n,a.s,S.f.r,F);
const MS=[10000,50000,100000,250000,500000,1000000];
return P('[FIRE] Zielzahl',`<div class="k big"><b>${eur(F)}</b><span>FIRE-Zahl</span></div><div class="bar"><i style="width:${pc}%"></i></div><div class="mut">${pct(pc)} erreicht · ${eur(n)}</div><div class="g2" style="margin-top:12px"><div class="k"><b>${y==null?'–':y<0.1?'jetzt':y.toFixed(1).replace('.',',')+' J.'}</b><span>bis FIRE</span></div><div class="k"><b>${eur(a.s)}</b><span>Ø Sparleistung/Mon.</span></div></div>`+
`<div class="note">Berechnung automatisch: Monatsausgaben × 12 ÷ Entnahmerate. Beispiel: 3.000 € × 12 ÷ 4 % = 900.000 €. Aktuell automatisch wären ${eur(autoF)}. ${basisText()}. Du kannst das FIRE-Ziel unten auch direkt überschreiben.</div><div class="hatch"></div><div class="row"><div><label>Ausgaben/Mon. €</label><input id="fe" type="number" inputmode="decimal" aria-label="Ausgaben pro Monat in Euro" value="${S.f.exp}" placeholder="${Math.round(a.o)}"></div><div><label>Entnahme %</label><input id="fw" type="number" step="0.1" aria-label="Entnahme in Prozent" value="${S.f.wr}"></div><div><label>Rendite %</label><input id="fr" type="number" step="0.1" aria-label="Rendite in Prozent" value="${S.f.r}"></div></div><label>FIRE-Ziel manuell € (leer oder 0 = automatisch)</label><input id="ft" type="number" inputmode="decimal" aria-label="FIRE-Ziel manuell in Euro" value="${S.f.fireTarget||''}" placeholder="Automatisch: ${Math.round(autoF)}"><button class="btn o" ${act('setF')}>Übernehmen</button>`)
+P('[Meilensteine]',MS.map((m,i)=>{const ok=n>=m,nx=!ok&&(i===0||n>=MS[i-1]),p=Math.max(0,Math.min(100,n/m*100));return `<div class="li ms${ok?' ok':nx?' nx':''}" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="mst">${ok?'✓':nx?'▶':'○'} <b>${eur(m)}</b><button class="mse" aria-label="Notiz" ${act('msNote',[m])}>✎</button></span><span class="msv">${ok?'erreicht':pct(p)}</span></div><div class="bar"><i style="width:${p}%"></i></div>${!ok?`<div class="mut">noch ${eur(m-n)}</div>`:''}${S.msn&&S.msn[m]?`<small class="msn">${esc(S.msn[m])}</small>`:''}</div>`}).join(''))
},
data(){return bk()+P('[Backup] Daten',`<textarea aria-label="Backup-Daten als JSON" id="bk" rows="3" placeholder="Export/Import (JSON)"></textarea><div class="row"><button class="btn o" ${act('exportBackup')}>Export</button><button class="btn o" ${act('importBackup')}>Import</button></div><div class="note">Daten liegen lokal in diesem Browser und werden bei aktivem Cloud-Sync auch synchronisiert. Vor einem Import wird die bisherige Ansicht nach Bestätigung ersetzt. Exportiere regelmäßig ein Backup.</div>`)},
goals(){const T=S.goals.reduce((s,g)=>s+g.t,0),C=S.goals.reduce((s,g)=>s+Math.min(Math.max(gv(g),0),g.t),0);return bk()+P('[Übersicht] Alle Ziele',S.goals.length?`<div class="k"><b>${eur(C)}</b><span>von ${eur(T)} · ${pct(T?C/T*100:0)}</span></div><div class="bar"><i style="width:${T?C/T*100:0}%"></i></div>`:'<span class="mut">Lege unten dein erstes Ziel an.</span>')+P('[Ziele] Sparziele',S.goals.map(g=>edRow('goals',g,`<div class="li" style="display:block" data-k="goals" data-id="${g.id}"><div style="display:flex;justify-content:space-between"><span><span class="hd">⠿</span>${esc(g.n)}</span><span>${eur(gv(g))} / ${eur(g.t)}${g.y?' · '+g.y:''} <button class="btn x" aria-label="Bearbeiten" ${act('edStart',['goals',g.id])}>✎</button> <button class="btn x" aria-label="Löschen" ${act('del',['goals',g.id])}>×</button></span></div><div class="bar"><i style="width:${Math.min(100,gv(g)/g.t*100)}%"></i></div>${goalCalc(g)}</div>`)).join('')+`<div class="row"><input aria-label="Name des Ziels" id="gn" placeholder="Ziel"><input aria-label="Zielbetrag in Euro" id="gt" type="number" inputmode="decimal" placeholder="Ziel €"></div><div class="row" style="margin-top:8px"><input aria-label="Deadline als Jahr" id="gy" type="number" inputmode="numeric" placeholder="Deadline (Jahr)"><select aria-label="Berechnung des Stands" id="gm"><option value="man">Manuell</option><option value="nw">Net Worth</option><option value="cash">Cash</option><option value="etf">ETF</option><option value="crypto">Krypto</option></select></div><input aria-label="Stand in Euro, nur manuell" id="gc" type="number" inputmode="decimal" placeholder="Stand € (nur manuell)" style="margin-top:8px"><button class="btn o" ${act('addGoal')}>Ziel anlegen</button>`)},
tax(){const ys=[...new Set(S.sales.map(x=>x.d.slice(0,4)).concat(String(new Date().getFullYear())))].sort();if(!ys.includes(txy))txy=ys[ys.length-1];
const L=S.sales.filter(x=>x.d.startsWith(txy)),gc=L.reduce((s,x)=>s+(x.gc||0),0),gp=L.reduce((s,x)=>s+(x.gp||0),0),tot=L.reduce((s,x)=>s+x.g,0),pb=S.f.pb!=null?S.f.pb:FREIBETRAG_KAP,kt=S.f.kt!=null?S.f.kt:TAX_KAP_PCT,ps=S.f.ps!=null?S.f.ps:30,use=Math.min(Math.max(gc,0),pb),taxK=Math.max(0,gc-pb)*kt/100,taxP=gp>=FREIGRENZE_SPEKU?gp*ps/100:0;
let free=0,wait=0,ue=0;S.as.forEach(a=>{if(a.k==='crypto'||a.k==='gold')(a.l||[]).forEach(x=>{const g=x.q*a.p-(x.q*x.p+x.f);if(x.d&&heldMore1Y(x.d))free+=g;else wait+=g});else if(a.k==='etf'&&a.c)ue+=(val(a)-a.c)*ETF_STEUERANTEIL;else if(a.k==='aktie'&&a.c)ue+=val(a)-a.c});
const ohne=S.as.filter(a=>(a.k==='etf'||a.k==='aktie')?!a.c:(a.k==='crypto'||a.k==='gold')&&!(a.l&&a.l.length)).length,left=Math.max(0,pb-Math.max(gc,0)),potK=Math.max(0,ue-left)*kt/100,pc=pb?Math.min(100,use/pb*100):0,inp=(l,k,v,st)=>`<div><label>${l}</label><input type="number" aria-label="${l}" step="${st}" value="${v}" ${act('setFNum',[k,'$value'],'change')}></div>`;
return bk()+P('[Steuerjahr] '+esc(txy),`<select aria-label="Steuerjahr" ${act('setTxy',['$value'],'change')}>${ys.map(y=>`<option ${y===txy?'selected':''}>${esc(y)}</option>`).join('')}</select><div class="g2" style="margin-top:12px"><div class="k"><b class="${tot>=0?'pos':'neg'}">${eur(tot)}</b><span>Realisierte G/V</span></div><div class="k"><b>${eur(taxK+taxP)}</b><span>Steuer (Schätzung)</span></div></div>`)
+P('[Pauschbetrag]',`<div class="k"><b class="${pc>90?'neg p':'pos'}">${eur(use)}</b><span>von ${eur(pb)} genutzt · ${eur(left)} frei (ETF/Aktien)</span></div><div class="bar"><i style="width:${pc}%"></i></div><div class="mut">Kapitalerträge nach Teilfreistellung: ${eur(gc)} → Steuer ${eur(taxK)}</div><div class="mut" style="margin-top:6px">Krypto/Gold (Haltefrist &lt; 1 J.): ${eur(gp)} → ${gp>=FREIGRENZE_SPEKU?'Steuer ca. '+eur(taxP):'unter Freigrenze 1.000 €, steuerfrei'}</div><div class="row">${inp('Pauschbetrag €','pb',pb,1)}${inp('Abgeltung %','kt',kt,.001)}${inp('Pers. Satz %','ps',ps,1)}</div>`)
+P('[Unrealisiert]',`<div class="li"><span class="mut">Krypto/Gold steuerfrei (&gt;1 J.)</span><b class="pos">${eur(free)}</b></div><div class="li"><span class="mut">Krypto/Gold in Haltefrist</span><b>${eur(wait)}</b></div><div class="li"><span class="mut">ETF/Aktien (nach Teilfreistell.)</span><b>${eur(ue)}</b></div><div class="li"><span class="mut">Steuer bei Verkauf heute (ETF/Aktien)</span><b>${eur(potK)}</b></div>${ohne?`<div class="note">${ohne} Position(en) ohne Einstand (kein Einstand erfasst): nicht in der Schätzung, Gewinn nicht bestimmbar.</div>`:''}<div class="note">Vereinfachte Schätzung ohne Verlustverrechnung über Jahre, Vorabpauschale und Kirchensteuer. Positionen ohne Kaufdatum zählen als „in Haltefrist“. Keine Steuerberatung.</div>`)
+P('[Annahmen] Steuer',`<div class="li"><span class="mut">Abgeltung + Soli (Feld oben)</span><b>${pct3(kt)} %</b></div><div class="li"><span class="mut">Pauschbetrag (Feld oben)</span><b>${eur(pb)}</b></div><div class="li"><span class="mut">Teilfreistellung Aktien-ETF (fest)</span><b>30 %</b></div><div class="li"><span class="mut">Teilfreistellung Prognose und Fuck-Off-Rechner</span><b>${tfWert()} %</b></div><div class="li"><span class="mut">Kirchensteuer Prognose und Fuck-Off-Rechner</span><b>${kistWert()?kistWert()+' % (Gesamtsatz '+pct3(kirchSatz(kistWert()))+' %)':'keine'}</b></div><div class="li"><span class="mut">Kirchensteuer Steuer-Übersicht</span><b>nicht berücksichtigt</b></div><div class="note">Teilfreistellung und Kirchensteuer der Prognose und des Fuck-Off-Rechners stellst du dort ein. Die Werte sind Annahmen und nicht gegen aktuelle Gesetzestexte geprüft.</div><div class="note">Vereinfacht: Verluste werden nur im selben Jahr verrechnet, nicht über Jahre (kein Verlustvortrag). Vorabpauschale: nicht modelliert. Sie fällt bei thesaurierenden Fonds jährlich an und mindert den Zinseszins, deshalb kann der Endwert netto der Prognose zu hoch ausfallen. Die Prognose setzt die Steuer in der Ansparphase einmalig am Ende an, in der Entnahmephase je Jahr. Keine Steuerberatung.</div>`)+P('[Verkäufe]',L.sort((a,b)=>b.d.localeCompare(a.d)).map(x=>`<div class="li"><span>${esc(x.n)}<small>${esc(x.d)} · ${esc(KIND[x.k]||x.k)}</small></span><span class="${x.g>=0?'pos':'neg'}">${eur(x.g)} <button class="btn x" aria-label="Löschen" ${act('del',['sales',x.id])}>×</button></span></div>`).join('')||'<span class="mut">Keine Verkäufe in diesem Jahr. Verkäufe buchst du bei Vermögen mit „− Verkauf“.</span>')},
more(){return P('[Module]',[['year','Jahresübersicht'],['port','Portfolio &amp; Risiko'],['crypto','Krypto'],['acct','Konto &amp; Sync'],['goals','Ziele &amp; Sparrate'],['tax','Steuer-Übersicht'],['data','Daten &amp; Backup']].map(([k,l])=>`<button class="btn o" style="text-align:left" ${act('goTab',[k])}>${l}</button>`).join(''))},
year(){const ys=[...new Set(S.tx.map(x=>x.d.slice(0,4)).concat(mo.slice(0,4)))].sort();if(!ys.includes(yr))yr=ys[ys.length-1];const rows=[];let I=0,O=0,W=0;for(let m=1;m<=12;m++){const l=S.tx.filter(x=>x.d.startsWith(yr+'-'+String(m).padStart(2,'0')));if(!l.length)continue;const i=sm(l,'in'),o=sm(l,'out'),v=l.filter(x=>x.c==='Sparen/Invest').reduce((s,x)=>s+x.a,0);I+=i;O+=o;W+=v;rows.push([new Date(yr,m-1).toLocaleDateString('de-DE',{month:'short'}),i,o,v,i-o])}
const n=rows.length||1,td='style="text-align:right;padding:6px 4px;border-bottom:1px solid var(--ln)"';
return bk()+P('[Jahr]',`<select aria-label="Jahr" ${act('setYr',['$value'],'change')}>${ys.map(y=>`<option ${y===yr?'selected':''}>${esc(y)}</option>`).join('')}</select><div class="g2" style="margin-top:12px"><div class="k"><b class="pos">${eur(I)}</b><span>Income</span></div><div class="k"><b class="neg">${eur(O)}</b><span>Expenses</span></div><div class="k"><b>${eur(W)}</b><span>Investments</span></div><div class="k"><b>${I?pct(W/I*100):'–'}</b><span>Sparquote</span></div><div class="k"><b>${eur(I-O)}</b><span>Cashflow</span></div><div class="k"><b>${eur((I-O)/n)}</b><span>Ø monatlich</span></div></div>`)+P('[Monate]','<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:11px"><tr><th align="left">Monat</th><th>Income</th><th>Exp.</th><th>Inv.</th><th>CF</th></tr>'+rows.map(r=>`<tr><td style="padding:6px 4px;border-bottom:1px solid var(--ln)">${r[0]}</td>${r.slice(1).map(v=>`<td ${td}>${eur(v)}</td>`).join('')}</tr>`).join('')+'</table></div>')},
port(){const n=nw(),ks=Object.keys(KIND).filter(k=>byK(k)>0),R=60,C=2*Math.PI*R;let off=0;const arcs=ks.map(k=>{const f=n?byK(k)/n:0,s=`<circle cx="80" cy="80" r="${R}" fill="none" stroke="${COL[k]}" stroke-width="22" stroke-dasharray="${f*C} ${C}" stroke-dashoffset="${-off*C}" transform="rotate(-90 80 80)"/>`;off+=f;return s}).join('');
const cp=n?byK('crypto')/n*100:0,cz=S.f.cz||25,big=[...S.as].sort((a,b)=>val(b)-val(a))[0],R2=(a,b)=>`<div class="li"><span class="mut">${a}</span><b>${b}</b></div>`;
return bk()+P('[Portfolio] Allocation',`<svg role="img" aria-label="Kreisdiagramm: Portfolio-Verteilung" viewBox="0 0 160 160" style="max-width:220px;margin:auto"><circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--ln)" stroke-width="22"/>${arcs}<text x="80" y="78" font-size="8" text-anchor="middle" fill="var(--mut)">NET WORTH</text><text x="80" y="92" font-size="11" text-anchor="middle" fill="var(--ink)">${eur(nn())}</text></svg>`+ks.map(k=>`<div class="li"><span><span aria-hidden="true" style="color:${COL[k]}">■</span> ${KIND[k]}</span><span>${pct(n?byK(k)/n*100:0)} · ${eur(byK(k))}</span></div>`).join(''))+P('[Risiko-Check]',R2('Krypto-Anteil',`<span class="${cp>cz?'neg':'pos'}">${pct(cp)}</span>`)+R2(`Krypto-Ziel % <input type="number" aria-label="Krypto-Ziel in Prozent" value="${cz}" ${act('setFNum',['cz','$value'],'change')} style="width:70px;padding:4px">`,'')+R2('Abweichung',(cp-cz>0?'+':'')+pct(cp-cz)+'-Pkt.')+R2('Cash-Anteil',pct(n?byK('cash')/n*100:0))+R2('Größte Position',big?esc(big.n)+' · '+eur(val(big)):'–')+R2('FIRE-Ziel',eur(fireF())))},
login(){return P('[Login] Finanz-Radar',`<label>E-Mail</label><input aria-label="E-Mail" id="le" type="email" autocomplete="username" inputmode="email" value="${esc(lem)}"><label>Passwort</label><input aria-label="Passwort" id="lp" type="password" autocomplete="current-password"><button class="btn" ${act('login',[false])}>Anmelden</button><button class="btn o" ${act('login',[true])}>Neues Konto registrieren</button><div class="row"><button class="btn o" ${act('magic')}>Login-Link per E-Mail</button><button class="btn o" ${act('forgot')}>Passwort vergessen</button></div><div class="note">${esc(syncMsg)}</div>`)},
newpw(){return P('[Passwort] Neu setzen',`<input aria-label="Neues Passwort" id="np" type="password" autocomplete="new-password" placeholder="Neues Passwort (mind. 6 Zeichen)"><button class="btn" ${act('setPw')}>Passwort speichern</button><div class="note">${esc(syncMsg)}</div>`)},
acct(){if(!sb)return bk()+P('[Konto]','<div class="note">Cloud-Sync ist noch nicht eingerichtet. Trage Project URL und anon-Key in <b>config.js</b> ein (siehe README). Bis dahin läuft die App lokal in diesem Browser.</div>');
return bk()+P('[Konto]',`<div class="li"><span class="mut">Angemeldet als</span><b>${esc(user&&user.email)}</b></div><div class="${syncOk===false?'neg':'pos'}" style="margin:8px 0">${esc(syncText()||'Bereit')}</div><button class="btn" ${act('pushNun')}>Jetzt hochladen</button><button class="btn o" ${act('pull',[false])}>Aus Cloud laden</button>`)+P('[Passwort] ändern',`<input aria-label="Neues Passwort" id="np" type="password" autocomplete="new-password" placeholder="Neues Passwort (mind. 6 Zeichen)"><button class="btn o" ${act('setPw')}>Passwort ändern</button>`)+P('[Sitzung]',`<button class="btn o" ${act('logout',[false])}>Abmelden</button><button class="btn o" ${act('logoutLokal')}>Abmelden &amp; lokale Daten löschen</button>`)},
crypto(){const l=S.as.filter(a=>a.k==='crypto').sort((a,b)=>val(b)-val(a)),v=byK('crypto'),mit=l.filter(a=>a.c>0),inv=mit.reduce((s,a)=>s+a.c,0),g=mit.reduce((s,a)=>s+val(a)-a.c,0),cl=g>=0?'pos':'neg';
return bk()+liveHTML()+pfHTML()+P('[Krypto] Portfolio',`<div class="g2"><div class="k"><b>${eur(v)}</b><span>Portfoliowert</span></div><div class="k"><b>${inv?eur(inv):'–'}</b><span>Investiert</span></div><div class="k"><b class="${cl}">${inv?(g>=0?'+':'')+eur(g):'–'}</b><span>Gewinn / Verlust</span></div><div class="k"><b class="${cl}">${inv?(g>=0?'+':'')+pct(g/inv*100):'–'}</b><span>Performance</span></div></div>`)+P('[Verteilung]',pie(l.map(a=>({n:a.n,v:val(a)})),eur(v)))+P('[Coins] Verteilung &amp; Kurse',l.map(a=>`<div class="li" style="display:block"><div style="display:flex;justify-content:space-between"><span>${esc(a.n)}</span><b>${pct(v?val(a)/v*100:0)} · ${eur(val(a))}</b></div><div class="bar"><i style="width:${v?val(a)/v*100:0}%"></i></div><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="mut">${a.q.toLocaleString('de-DE')} × € · Ø ${a.q&&a.c?Math.round(a.c/a.q).toLocaleString('de-DE')+' €':'–'}</span><input type="number" inputmode="decimal" aria-label="Kurs je Einheit in Euro" value="${a.p}" ${act('setP',[a.id,'$value'],'change')} style="width:120px;padding:4px 6px;font-size:16px"><span class="${val(a)-(a.c||0)>=0?'pos':'neg'}">${a.c?eur(val(a)-a.c):''}</span></div></div>`).join('')||'<span class="mut">Noch keine Coins. Füge sie unter Vermögen (Typ Krypto) hinzu.</span>')+'<div class="note">Kurse pflegst du hier manuell: Live-Kurse (CoinGecko) sind in dieser Seite technisch nicht abrufbar.</div>'+(l.length>mit.length?`<div class="note">${l.length-mit.length} Position(en) ohne Einstand: nicht in Investiert und G/V.</div>`:'')}};
const TABS=[['home','Home'],['cash','Cashflow'],['assets','Vermögen'],['fire','FIRE'],['plan','Prognose'],['more','Mehr']],SUB=['goals','tax','data','year','port','crypto','acct'],TT={home:'Home',cash:'Cashflow',assets:'Vermögen',fire:'FIRE',more:'Mehr',plan:'Prognose',goals:'Ziele',tax:'Steuer',data:'Daten',year:'Jahresübersicht',port:'Portfolio',crypto:'Krypto',acct:'Konto'};
/* Navigation: eine Markup-Quelle für Icon-Rail (Desktop) und Tab-Leiste (Mobil). CSS schaltet zwischen beiden um. Icons: Strich-Stil, viewBox 24, wie endurance-hub. */
const NAV_IC={home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',cash:'<path d="M3 8h13l-3-3M21 16H8l3 3"/>',assets:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',fire:'<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',plan:'<path d="M3 19h18"/><path d="M5 15l4-4 3 3 6-7"/>',more:'<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>'};
const navHTML=()=>'<span class="logo" aria-hidden="true">F</span>'+TABS.map(([k,l])=>{const on=tab===k||(k==='more'&&SUB.includes(tab));return `<button type="button" class="rail-item" aria-label="${l}"${on?' aria-current="page"':''} ${act('goTab',[k])}><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${NAV_IC[k]}</svg><span class="tip">${l}</span></button>`}).join('');
function render(){edCap();if(sb&&(!authReady||!user||recMode)){$('tb').innerHTML='';$('ttl').textContent='Login';$('v').innerHTML=!authReady?P('[Auth]','Lade …'):recMode&&user?V.newpw():V.login();applyTh();return}
if(user&&S.uid&&S.uid!==user.id){$('tb').innerHTML='';$('ttl').textContent='Konto';$('v').innerHTML=kontoOffen()?kontoHTML():'<div class="panel"><h2>Konto</h2><div class="note">Konto wird geladen …</div></div>';applyTh();if($('kf_b1'))$('kf_b1').focus();return}
$('tb').innerHTML=navHTML();$('ttl').textContent=TT[tab];const lv=$('lv');if(lv){const st=!user?'Nur lokal gespeichert':syncOk===null?'Synchronisierung läuft':syncOk?'Synchronisiert':'Synchronisierung fehlgeschlagen';lv.classList.toggle('pulse',!!user&&syncOk===null);lv.setAttribute('aria-label',st);lv.title=st}applyTh();snap();const fresh=lastTab!==tab;lastTab=tab;$('v').className=fresh?'in':'';$('v').innerHTML=legacyNotice()+konfliktHTML()+V[tab]();if(konfl&&kfOpen)$('kf_b1').focus();edFocus();ordP();blurNums();
$('bd').textContent=eur(nn());if(fresh)cu();}
render();initAuth();
