/** Free-plan attended snapshots: never a timer, no third-party execution. */
import {getHistory,saveHistoryData} from './store-v5.mjs';
import {MARKETS} from './scanner.mjs';
import {planSummary,suggestedMinimumSeconds,isDue,candleAudit,validateSnapshot} from './free-collector-core.mjs';
const $=id=>document.getElementById(id);
const market=$('freeMarket'),tfEl=$('freeTf'),status=$('freeStatus'),quota=$('freeQuota'),coverage=$('freeCoverage');
if(!market||!tfEl||!status||!quota||!coverage)throw Error('Missing Free collector controls');
for(const item of MARKETS){const option=document.createElement('option');option.value=item.symbol;option.textContent=item.name;market.append(option)}
const localKey=()=>`msai.freeCollector.last.${market.value}.${tfEl.value}`;
const fmtTime=s=>Number.isFinite(s)?new Date(s*1000).toLocaleString():'—';
const ownerCode=()=>$('accessCode').value.trim();
const setStatus=text=>{status.textContent=text};
let busy=false;
async function loadUsage(){
 const code=ownerCode();
 if(!code){quota.textContent='Enter your private scanner access code on the Scanner tab first.';return null}
 const res=await fetch('/.netlify/functions/candles?usage=1',{cache:'no-store',headers:{'x-scanner-code':code}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||`Plan check failed (${res.status})`);
 const out=planSummary(data);
 const remaining=out.remaining===null?'not reported':out.remaining.toLocaleString();
 const cap=out.quota===null?'not reported':out.quota.toLocaleString();
 const stream=out.streams===null?'unknown':out.streams>0?`${out.streams} slot(s) enabled`:'not enabled';
 quota.textContent=`Plan: ${out.plan} · ${remaining}/${cap} requests remain · period: ${out.period} · streaming: ${stream}. ${out.reset?'Resets '+fmtTime(out.reset)+'.':''}`;
 return out;
}
async function refreshCoverage(){
 const rows=[];
 for(const item of MARKETS)for(const tf of [30,60]){
  const data=await getHistory(item.symbol,tf).catch(()=>null);
  if(!data?.candles?.length)continue;
  const r=candleAudit(data.candles,tf);
  rows.push(`${item.short||item.name} · ${tf}s: ${r.count.toLocaleString()} candles, ${r.days} UTC day(s), ${r.gaps} gap(s), latest ${fmtTime(r.last)}.`);
 }
 coverage.replaceChildren();
 if(!rows.length){coverage.textContent='No IndexedDB candle archive found in this browser. Existing scanner snapshots are saved here after a scan.';return}
 for(const line of rows){const p=document.createElement('p');p.className='hint';p.textContent=line;coverage.append(p)}
}
async function saveOne(){
 if(busy)return;
 const code=ownerCode();if(!code){setStatus('Enter your scanner access code on the Scanner tab first.');return}
 const sym=market.value,tf=Number(tfEl.value),button=$('freeCapture');
 if(!isDue(Number(localStorage.getItem(localKey())||0),Date.now(),tf)){
  setStatus(`A ${sym} ${tf}s snapshot was already collected recently. To protect Free credits, wait at least ${Math.ceil(suggestedMinimumSeconds(tf)/3600)} hours between snapshots of the same market and interval.`);
  return;
 }
 busy=true;button.disabled=true;button.textContent='CHECKING ALLOWANCE…';
 try{
  const plan=await loadUsage();
  if(!plan){setStatus('Check your access code first.');return}
  if(plan.remaining!==null&&plan.remaining<1){setStatus('No requests remain. Your already-saved research still works for free.');return}
  button.textContent='SAVING NEW CANDLES…';
  const res=await fetch(`/.netlify/functions/candles?symbol=${encodeURIComponent(sym)}&tf=${tf}&limit=5000`,{cache:'no-store',headers:{'x-scanner-code':code}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||`Download failed (${res.status})`);
  if(!validateSnapshot(data,sym,tf))throw Error('Provider returned an empty or invalid candle set');
  const total=await saveHistoryData(sym,tf,data.candles);
  localStorage.setItem(`msai.freeCollector.last.${sym}.${tf}`,String(Date.now()));
  const audit=candleAudit(data.candles,tf);
  setStatus(`Saved ${data.candles.length.toLocaleString()} returned candles. Archive now has ${total.toLocaleString()} distinct candles for ${sym} (${tf}s). The snapshot has ${audit.gaps} gap(s). One provider candle request used. Not a live tick feed.`);
  await refreshCoverage();await loadUsage().catch(()=>{});
 }catch(e){setStatus('Snapshot not saved: '+(e.message||String(e)))}
 finally{busy=false;button.disabled=false;button.textContent='COLLECT SELECTED MARKET SNAPSHOT (1 REQUEST)'}
}
async function exportBackup(){
 const items=[];
 for(const m of MARKETS)for(const tf of [30,60]){
  const data=await getHistory(m.symbol,tf).catch(()=>null);
  if(data?.candles?.length)items.push({symbol:m.symbol,tf,candles:data.candles});
 }
 if(!items.length){setStatus('No candle history has been archived in this browser.');return}
 const backup={schema:'market-shaker-offline-candles-v1',exportedAt:new Date().toISOString(),datasets:items};
 const raw=JSON.stringify(backup);
 if(raw.length>50_000_000){setStatus('Archive too large for one browser backup. Export individual market CSV files instead.');return}
 const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=`market-shaker-otc-archive-${new Date().toISOString().slice(0,10)}.json`;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
 setStatus(`Downloaded a backup of ${items.length} market archives. Store it safely outside the browser.`);
}
async function restoreBackup(file){
 if(!file)return;
 try{
  if(file.size>60_000_000)throw Error('Backup file is too large for browser restore');
  const data=JSON.parse(await file.text());
  if(data?.schema!=='market-shaker-offline-candles-v1'||!Array.isArray(data.datasets)||data.datasets.length>10)throw Error('Invalid Market Shaker archive file');
  let count=0;
  for(const x of data.datasets){
   if(!MARKETS.some(m=>m.symbol===x.symbol)||![30,60].includes(Number(x.tf))||!Array.isArray(x.candles))throw Error('Archive contains unknown markets or timeframes');
   if(!x.candles.length)continue;
   if(!validateSnapshot({source:'OTCharts / Pocket Option OTC (independent feed)',symbol:x.symbol,tf:Number(x.tf),candles:x.candles},x.symbol,Number(x.tf)))throw Error('Archive candle rows are invalid');
   await saveHistoryData(x.symbol,Number(x.tf),x.candles);count+=x.candles.length;
  }
  await refreshCoverage();setStatus(`Restored ${count.toLocaleString()} historical candle rows. No API requests made.`);
 }catch(e){setStatus('Restore failed: '+e.message)}
 finally{$('freeRestore').value=''}
}
$('freeCheck').addEventListener('click',()=>loadUsage().catch(e=>{quota.textContent='Could not check allowance: '+e.message}));
$('freeCapture').addEventListener('click',saveOne);
$('freeBackup').addEventListener('click',()=>exportBackup().catch(e=>setStatus('Backup failed: '+e.message)));
$('freeRestore').addEventListener('change',e=>restoreBackup(e.target.files?.[0]));
refreshCoverage().catch(e=>setStatus('Local archive unavailable: '+e.message));
