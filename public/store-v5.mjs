/** IndexedDB market history vault: persistent on this browser/device only.
 * Larger than localStorage. The Windows collector separately retains original tick NDJSON files.
 */
const DB='market-shaker-history-v5',STORE='datasets';
function openDb(){return new Promise((resolve,reject)=>{
 const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);
 r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});}
const transact=async(type,key,value)=>{
 const db=await openDb();try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,type),store=tx.objectStore(STORE);
  const request=type==='readonly'?store.get(key):store.put(value,key);
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 })}finally{db.close()}
};
const key=(symbol,tf)=>`${symbol}:${tf}`;
export async function getHistory(symbol,tf){return await transact('readonly',key(symbol,tf))||null}
export async function saveHistoryData(symbol,tf,newBars){
 const old=await getHistory(symbol,tf);
 const merged=[...new Map([...(old?.candles||[]),...newBars].map(c=>[Number(c.time),c])).values()]
  .sort((a,b)=>Number(a.time)-Number(b.time));
 // One month of 5-second candles is ~518,400 bars; cap at one million per (market, interval).
 const data={symbol,tf,candles:merged.slice(-1000000),updatedAt:Date.now()};
 await transact('readwrite',key(symbol,tf),data);return data.candles.length;
}
export function parseCandleCSV(text){
 const lines=text.trim().split(/\r?\n/);if(lines.length<2)throw Error('The file contains no candle rows');
 const header=lines[0].toLowerCase().split(',').map(x=>x.trim());
 const positions=['time','open','high','low','close'].map(x=>header.indexOf(x));
 if(positions.some(x=>x<0))throw Error('CSV must contain: time,open,high,low,close');
 const bars=[];
 for(const line of lines.slice(1)){
  if(!line.trim())continue;
  const values=line.split(','),numbers=positions.map(i=>Number(values[i]));
  if(numbers.some(n=>!Number.isFinite(n)))continue;
  const [time,open,high,low,close]=numbers;
  if(time>0&&low<=Math.min(open,close)&&high>=Math.max(open,close))bars.push({time,open,high,low,close});
 }
 return bars;
}
