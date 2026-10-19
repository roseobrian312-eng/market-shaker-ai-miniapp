import {analyzeSmart} from './engine/strategies.mjs';

const API='https://market-shaker-ai-miniapp.netlify.app/.netlify/functions/candles';
const SYMBOLS=new Set(['EURUSD_otc','GBPUSD_otc','USDJPY_otc','AUDUSD_otc','BTCUSD_otc']);
const TFS=new Set([5,15,30,60]);
const STRATEGIES=new Set(['pullback','baseline']);
const get=keys=>chrome.storage.local.get(keys);
const set=values=>chrome.storage.local.set(values);
let requestRunning=false;
let lastRequest=0;

function isPocket(url){ try {const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='pocketoption.com'||u.hostname.endsWith('.pocketoption.com'));}catch{return false;} }
function niceError(e){return e instanceof Error?e.message:String(e);}
function responseSummary(data,params,saved=false){
  if(data.source!=='OTCharts / Pocket Option OTC (independent feed)'||data.symbol!==params.symbol||Number(data.tf)!==params.tf||!Array.isArray(data.candles))throw Error('Unexpected market data or asset');
  const scan=analyzeSmart(data.candles,params.tf,Math.floor(Date.now()/1000),{open:data.open},params.strategy);
  if(data.gaps?.runs>0){scan.side=null;scan.status='gap';scan.reason='Data provider reported missing candles';}
  if(params.tf<30){scan.side=null;scan.status='lab-only';scan.reason='Under 30s: research-only, no manual-entry alert';}
  return {status:scan.status,side:scan.side??null,reason:scan.reason,trend:scan.trend||'—',rsi:Number.isFinite(scan.rsi)?scan.rsi:null,
     price:Number.isFinite(scan.lastClose)?scan.lastClose:null,candleTime:scan.lastBarTime||null, checkedAt:Date.now(),saved,
     symbol:params.symbol,tf:params.tf,strategy:params.strategy,barCount:data.candles.length};
}
function tally(rows){let wins=0,losses=0;for(const r of rows){if(r.outcome==='win')wins++;else if(r.outcome==='loss')losses++;}return {wins,losses,total:wins+losses,winRate:wins+losses?100*wins/(wins+losses):null};}
async function handle(message){
 if(message.type==='MSAI_OPTIONS'){return {ok:true,configured:!!(await get(['accessCode'])).accessCode};}
 if(message.type==='MSAI_OPEN_SETTINGS'){chrome.runtime.openOptionsPage();return {ok:true};}
 if(message.type==='MSAI_GET_STATS'){
   const {records=[]}=await get(['records']);return {ok:true,stats:tally(records),records:records.slice(0,5)};
 }
 if(message.type==='MSAI_SCAN'){
   const {symbol,tf,strategy='pullback',cached=false}=message;
   if(!SYMBOLS.has(symbol)||!TFS.has(tf)||!STRATEGIES.has(strategy))throw Error('Unsupported market, candle duration or strategy');
   const {accessCode,datasets={}}=await get(['accessCode','datasets']);
   const key=`${symbol}:${tf}`;
   if(cached){if(!datasets[key])throw Error('No saved candles for this market yet');return {ok:true,signal:responseSummary(datasets[key],{symbol,tf,strategy},true)};}
   if(!accessCode)throw Error('Add your scanner access code in extension settings first');
   if(requestRunning)throw Error('Another scan is already running');
   if(Date.now()-lastRequest<8000)throw Error('Wait 8 seconds between paid API refreshes');
   lastRequest=Date.now();requestRunning=true;
   try{
     const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);
     let res;try{res=await fetch(`${API}?symbol=${encodeURIComponent(symbol)}&tf=${tf}`,{headers:{'x-scanner-code':accessCode},cache:'no-store',signal:controller.signal});}
     finally{clearTimeout(timer);}
     const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||`Market-data request failed: HTTP ${res.status}`);
     datasets[key]=data;await set({datasets});return {ok:true,signal:responseSummary(data,{symbol,tf,strategy})};
   } finally{requestRunning=false;}
 }
 if(message.type==='MSAI_REPORT'){
   if(!['win','loss'].includes(message.outcome))throw Error('Choose win or loss');
   const {records=[]}=await get(['records']);
   const id=String(message.id||'');if(!/^([A-Za-z0-9:_-]{10,180})$/.test(id))throw Error('No valid signal selected');
   if(records.some(x=>x.id===id))throw Error('This signal was already recorded');
   const record={id,outcome:message.outcome,symbol:String(message.symbol||''),side:message.side==='CALL'?'CALL':'PUT',time:Date.now(),source:'user-reported'};
   records.unshift(record);await set({records:records.slice(0,1000)});return {ok:true,stats:tally(records)};
 }
 throw Error('Unknown request');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!isPocket(sender.url||sender.tab?.url))return false;
  if(!message||typeof message.type!=='string'||!message.type.startsWith('MSAI_'))return false;
  handle(message).then(reply).catch(e=>reply({ok:false,error:niceError(e)}));
  return true;
});
