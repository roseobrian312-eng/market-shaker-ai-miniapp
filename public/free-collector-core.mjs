/** No-cost historical collection helpers; no browser globals or network requests. */
export function planSummary(payload) {
  const q=payload?.requests||{},s=payload?.streams||{};
  const finite=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
  return {plan:String(payload?.planName||payload?.plan||'Unknown'),remaining:finite(q.remaining),
    quota:finite(q.quota),used:finite(q.used),
    period:String(q.per||q.quota_per||payload?.quota_per||'provider-defined'),
    reset:finite(q.resets),streams:finite(s.limit)};
}
export function suggestedMinimumSeconds(tf){return tf===30?4*3600:tf===60?36*3600:Infinity}
export function isDue(lastRequestedAtMs,nowMs,tf){
  return !Number.isFinite(Number(lastRequestedAtMs))||Number(lastRequestedAtMs)<=0||
    nowMs-Number(lastRequestedAtMs)>=suggestedMinimumSeconds(tf)*1000;
}
export function candleAudit(candles,tf){
 if(!Array.isArray(candles)||!candles.length)return {count:0,days:0,first:null,last:null,missing:0,gaps:0};
 const times=[...new Set(candles.map(c=>Number(c.time)).filter(t=>Number.isFinite(t)&&t>0))].sort((a,b)=>a-b);
 let missing=0,gaps=0;
 for(let i=1;i<times.length;i++){const delta=times[i]-times[i-1];if(delta>tf){gaps++;missing+=Math.max(0,Math.round(delta/tf)-1)}}
 return {count:times.length,first:times[0],last:times.at(-1),
   days:new Set(times.map(t=>Math.floor(t/86400))).size,missing,gaps};
}
export function validateSnapshot(data,symbol,tf){
 return data?.source==='OTCharts / Pocket Option OTC (independent feed)'&&
 data.symbol===symbol&&Number(data.tf)===tf&&Array.isArray(data.candles)&&
 data.candles.length>0&&data.candles.every(b=>[b.time,b.open,b.high,b.low,b.close].every(v=>Number.isFinite(Number(v)))&&
 Number(b.high)>=Math.max(Number(b.open),Number(b.close))&&Number(b.low)<=Math.min(Number(b.open),Number(b.close)));
}
