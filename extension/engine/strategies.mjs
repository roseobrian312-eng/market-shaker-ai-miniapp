/** Short-expiry strategy research; price-only observations, not broker fills. */
import {ema,rsi} from './scanner.mjs';
export const STRATEGIES=[
 {id:'pullback',name:'Trend / Pullback Confirmation'},
 {id:'baseline',name:'EMA 9/21 + RSI Baseline'}
];
export const TF_LIST=[5,15,30,60];
export const EXPIRIES=[15,20,30,60];
const ok=n=>Number.isFinite(n);
export function cleanBars(raw, tf, now=Date.now()/1000){
 if(!TF_LIST.includes(tf)||!Array.isArray(raw))return [];
 const items=raw.map(c=>({time:Number(c.time),open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close)}))
 .filter(c=>[c.time,c.open,c.high,c.low,c.close].every(ok)&&c.time>0&&c.low<=Math.min(c.open,c.close)&&c.high>=Math.max(c.open,c.close))
 .sort((a,b)=>a.time-b.time);
 const dedup=new Map(items.map(b=>[b.time,b]));
 return [...dedup.values()].sort((a,b)=>a.time-b.time).filter(c=>c.time+tf<=now-2);
}
function average(a){return a.reduce((s,v)=>s+v,0)/a.length}
function features(bars,i){
 if(i<34)return null;
 const series=bars.slice(0,i+1), close=series.map(x=>x.close),c=series.at(-1),p=series.at(-2),pp=series.at(-3);
 const ema9=ema(close,9),ema21=ema(close,21),prior9=ema(close.slice(0,-1),9),prior21=ema(close.slice(0,-1),21),r=rsi(close,14);
 const range=Math.max(c.high-c.low,1e-10),body=Math.abs(c.close-c.open),atr=average(series.slice(-14).map((b,j)=>{
   const previous=series[series.length-14+j-1]?.close??b.open;
   return Math.max(b.high-b.low,Math.abs(b.high-previous),Math.abs(b.low-previous));
 }));
 return {c,p,pp,ema9,ema21,prior9,prior21,r,atr,range,body,bodyRatio:body/range,
   closeNearHigh:(c.close-c.low)/range,closeNearLow:(c.high-c.close)/range};
}
export function classify(bars,index,strategy='pullback'){
 const f=features(bars,index);if(!f)return {side:null,reason:'Insufficient candle history',factors:[]};
 const {c,p,pp,ema9,ema21,prior9,prior21,r,atr,bodyRatio,closeNearHigh,closeNearLow}=f;
 const up=ema9>ema21&&ema9>prior9&&ema21>=prior21;
 const down=ema9<ema21&&ema9<prior9&&ema21<=prior21;
 const rising=c.close>c.open&&c.close>p.close;
 const falling=c.close<c.open&&c.close<p.close;
 let call=false,put=false,reason='No high-quality setup on the last completed candle';
 if(strategy==='baseline'){
   call=ema9>ema21&&r>=51&&r<=72&&rising&&bodyRatio>=.20;
   put=ema9<ema21&&r<=49&&r>=28&&falling&&bodyRatio>=.20;
 }else if(strategy==='pullback'){
   // Trend established, previous bar retraces, current strong bar breaks previous range.
   const pulledBackUp=p.close<p.open||p.low<=ema9+atr*.15||p.close<pp.close;
   const pulledBackDown=p.close>p.open||p.high>=ema9-atr*.15||p.close>pp.close;
   const volatility=atr>0&&c.high-c.low>=atr*.45&&c.high-c.low<=atr*2.5;
   call=up&&r>=50&&r<=72&&pulledBackUp&&rising&&bodyRatio>=.50&&closeNearHigh>=.72&&c.close>p.high&&volatility;
   put=down&&r>=28&&r<=50&&pulledBackDown&&falling&&bodyRatio>=.50&&closeNearLow>=.72&&c.close<p.low&&volatility;
 }else throw new RangeError('Unknown strategy');
 const side=call?'CALL':put?'PUT':null;
 if(side)reason=strategy==='pullback'?'Trend, pullback and confirmation aligned':'EMA/RSI momentum conditions aligned';
 return {side,reason,trend:ema9>ema21?'Bullish':ema9<ema21?'Bearish':'Flat',rsi:r,ema9,ema21,
   factors:[`EMA 9 / EMA 21: ${ema9>ema21?'Bullish':'Bearish'}`,`RSI (14): ${r.toFixed(1)}`,
   `Candle strength: ${Math.round(bodyRatio*100)}% of range`,strategy==='pullback'?'Pullback plus breakout confirmation':'Directional momentum check']};
}
export function analyzeSmart(raw,tf,now=Math.floor(Date.now()/1000),meta={},strategy='pullback'){
 if(!TF_LIST.includes(tf))return {status:'error',side:null,reason:'Unsupported timeframe'};
 if(meta.open===false)return {status:'closed',side:null,reason:'Market reported closed'};
 const candles=cleanBars(raw,tf,now);
 if(candles.length<35)return {status:'waiting',side:null,reason:'At least 35 completed candles required'};
 const last=candles.at(-1);
 if(now-(last.time+tf)>Math.max(12,tf+4))return {status:'stale',side:null,reason:'Latest completed candle is too old',lastBarTime:last.time};
 if(candles.slice(-35).some((c,i,a)=>i&&c.time-a[i-1].time!==tf))return {status:'gap',side:null,reason:'Missing recent candles',lastBarTime:last.time};
 const x=classify(candles,candles.length-1,strategy);
 return {status:x.side?'watch':'neutral',...x,lastBarTime:last.time,lastClose:last.close,candles:candles.slice(-80),tf,checkedAt:now};
}
export function backtest(raw,tf,expiry=30,strategy='pullback',payout=85,now=Math.floor(Date.now()/1000)){
 if(!TF_LIST.includes(tf)||!EXPIRIES.includes(expiry)||expiry%tf!==0)return {error:'Choose an expiry divisible by the candle timeframe'};
 if(!Number.isFinite(payout)||payout<1||payout>100)return {error:'Payout must be between 1% and 100%'};
 const bars=cleanBars(raw,tf,now),horizon=expiry/tf;
 if(bars.length<100+horizon)return {error:'Need at least 100 closed candles plus expiry horizon'};
 const records=[];
 // Split by SIGNAL timestamp (not settled timestamp); discard outcomes crossing split.
 const pivot=Math.floor(bars.length*.7);
 for(let i=35;i<bars.length-horizon;i++){
   const base=i-34; const target=i+horizon;
   if(bars.slice(base,target+1).some((b,j,a)=>j&&b.time-a[j-1].time!==tf))continue;
   if(i<pivot&&target>=pivot)continue; // no training outcome leaks into holdout
   const sig=classify(bars,i,strategy);if(!sig.side)continue;
   // The next candle open is only a MODEL for immediate entry, not a verified broker fill.
   const entry=bars[i+1].open,exit=bars[target].close;
   const win=sig.side==='CALL'?exit>entry:exit<entry;
   const tie=exit===entry;
   records.push({time:bars[i].time,side:sig.side,entry,exit,outcome:tie?'tie':win?'win':'loss',split:i<pivot?'development':'holdout'});
 }
 function stats(section){
   const a=records.filter(r=>r.split===section),wins=a.filter(r=>r.outcome==='win').length,losses=a.filter(r=>r.outcome==='loss').length,ties=a.filter(r=>r.outcome==='tie').length;
   const eligible=wins+losses;const netUnits=(wins*payout/100)-losses;
   return {signals:a.length,wins,losses,ties,winRate:eligible?100*wins/eligible:null,netUnits:eligible?netUnits:null,perTrade:eligible?netUnits/eligible:null};
 }
 return {strategy,tf,expiry,payout,bars:bars.length,breakEven:10000/(100+payout),development:stats('development'),holdout:stats('holdout'),records:records.slice(-200),
   disclaimer:'Research only. Assumes next candle open fill without latency, costs or changing payouts. Not actual broker trades.'};
}
