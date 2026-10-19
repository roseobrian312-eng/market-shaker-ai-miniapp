/** v5 batch research: all decisions use only completed bars available at the signal timestamp.
 * Candidate ranking uses the validation partition; the last 20% is a diagnostic holdout.
 * Never converts research candidates into live instructions.
 */
import {cleanBars} from './strategies.mjs';
import {ema,rsi} from './scanner.mjs';

export const CANDIDATES = Object.freeze([
 {id:'trend_pullback',name:'Trend + Pullback'},
 {id:'ema_rsi',name:'EMA + RSI Momentum'},
 {id:'momentum_burst',name:'Momentum Burst'},
 {id:'channel_breakout',name:'Channel Breakout'},
 {id:'wick_reversal',name:'Wick Reversal'},
 {id:'mean_reversion',name:'Mean Reversion'},
 {id:'compression_breakout',name:'Compression Breakout'},
 {id:'momentum_breakout_hybrid',name:'Momentum + Breakout Hybrid'},
 {id:'pullback_momentum_hybrid',name:'Pullback + Momentum Hybrid'},
]);
const avg=a=>a.reduce((s,v)=>s+v,0)/Math.max(a.length,1);
function context(bars,i){
 if(i<50)return null;
 const c=bars[i],p=bars[i-1],pp=bars[i-2];
 // Bounded historical window, not an accidentally future-aware whole-series indicator.
 const part=bars.slice(Math.max(0,i-110),i+1),prices=part.map(x=>x.close);
 const fast=ema(prices,9),slow=ema(prices,21),prFast=ema(prices.slice(0,-1),9),prSlow=ema(prices.slice(0,-1),21);
 const strength=rsi(prices,14);
 const tr=bars.slice(i-20,i+1).map((b,j,a)=>Math.max(b.high-b.low,Math.abs(b.high-(j?a[j-1].close:b.open)),Math.abs(b.low-(j?a[j-1].close:b.open))));
 const atr=avg(tr.slice(-14)),normal=avg(tr.slice(-20));
 if(!Number.isFinite(atr)||atr<=0)return null;
 const rng=Math.max(1e-12,c.high-c.low),body=Math.abs(c.close-c.open)/rng;
 const prev10=bars.slice(i-10,i),prev6=bars.slice(i-6,i),prev3=bars.slice(i-3,i);
 return {c,p,pp,fast,slow,prFast,prSlow,strength,atr,normal,rng,body,
  upper:(c.high-Math.max(c.open,c.close))/rng,lower:(Math.min(c.open,c.close)-c.low)/rng,
  up:c.close>c.open,down:c.close<c.open,
  high10:Math.max(...prev10.map(x=>x.high)),low10:Math.min(...prev10.map(x=>x.low)),
  high6:Math.max(...prev6.map(x=>x.high)),low6:Math.min(...prev6.map(x=>x.low)),
  high3:Math.max(...prev3.map(x=>x.high)),low3:Math.min(...prev3.map(x=>x.low)),
  compressed:avg(prev6.map(x=>x.high-x.low)) < .72*normal,
  trendUp:fast>slow&&fast>prFast&&slow>=prSlow,
  trendDown:fast<slow&&fast<prFast&&slow<=prSlow};
}
function sides(f){
 const b={};const x=f;
 const rising=x.up&&x.c.close>x.p.close,falling=x.down&&x.c.close<x.p.close;
 const pbUp=x.p.close<x.p.open||x.p.low<=x.fast+x.atr*.15||x.p.close<x.pp.close;
 const pbDown=x.p.close>x.p.open||x.p.high>=x.fast-x.atr*.15||x.p.close>x.pp.close;
 const volOk=x.rng>=x.atr*.45&&x.rng<=x.atr*2.5;
 const cond=(up,down)=>up?'CALL':down?'PUT':null;
 b.trend_pullback=cond(x.trendUp&&x.strength>=50&&x.strength<=72&&pbUp&&rising&&x.body>=.5&&(x.c.close-x.c.low)/x.rng>=.72&&x.c.close>x.p.high&&volOk,
 x.trendDown&&x.strength<=50&&x.strength>=28&&pbDown&&falling&&x.body>=.5&&(x.c.high-x.c.close)/x.rng>=.72&&x.c.close<x.p.low&&volOk);
 b.ema_rsi=cond(x.fast>x.slow&&x.strength>=51&&x.strength<=72&&rising&&x.body>=.2,
 x.fast<x.slow&&x.strength<=49&&x.strength>=28&&falling&&x.body>=.2);
 b.momentum_burst=cond(rising&&x.body>=.6&&x.c.close>x.high3&&x.strength>=55&&x.strength<=78,
 falling&&x.body>=.6&&x.c.close<x.low3&&x.strength<=45&&x.strength>=22);
 b.channel_breakout=cond(x.c.close>x.high10&&rising&&x.body>.4&&x.fast>x.slow&&volOk,
 x.c.close<x.low10&&falling&&x.body>.4&&x.fast<x.slow&&volOk);
 b.wick_reversal=cond(x.lower>.54&&(x.c.close-x.c.low)/x.rng>.58&&x.strength<43&&x.c.low<x.low3&&x.c.close>x.p.close,
 x.upper>.54&&(x.c.high-x.c.close)/x.rng>.58&&x.strength>57&&x.c.high>x.high3&&x.c.close<x.p.close);
 b.mean_reversion=cond(x.c.close<x.slow-1.1*x.atr&&x.lower>.3&&x.strength<39&&x.c.close>x.c.open,
 x.c.close>x.slow+1.1*x.atr&&x.upper>.3&&x.strength>61&&x.c.close<x.c.open);
 b.compression_breakout=cond(x.compressed&&x.c.close>x.high6&&x.body>.45&&rising,
 x.compressed&&x.c.close<x.low6&&x.body>.45&&falling);
 const agree=(a,c)=>a&&c&&a===c?a:null;
 b.momentum_breakout_hybrid=agree(b.momentum_burst,b.channel_breakout);
 b.pullback_momentum_hybrid=agree(b.trend_pullback,b.ema_rsi);
 return b;
}
export function auditRawCandles(raw,tf,now=Date.now()/1000){
 const original=Array.isArray(raw)?raw:[];
 const bars=cleanBars(original,tf,now),bad=original.filter(c=>![c.time,c.open,c.high,c.low,c.close].every(v=>Number.isFinite(Number(v)))||Number(c.high)<Number(c.low)).length;
 const uniqueTs=new Set(original.map(x=>Number(x.time))).size;
 const gaps=[];let missing=0;
 for(let i=1;i<bars.length;i++){const dif=bars[i].time-bars[i-1].time;if(dif!==tf){gaps.push({after:bars[i-1].time,seconds:dif});if(dif>tf)missing+=Math.max(0,Math.round(dif/tf)-1)}}
 return {bars,report:{raw:original.length,validClosed:bars.length,duplicates:Math.max(0,original.length-uniqueTs),invalid:bad,missingBars:missing,gapRuns:gaps.length,first:bars[0]?.time??null,last:bars.at(-1)?.time??null,days:new Set(bars.map(c=>Math.floor(c.time/86400))).size,largestGapSeconds:gaps.length?Math.max(...gaps.map(x=>x.seconds)):0}};
}
const stats=(trades,payout)=>{
 const wins=trades.filter(r=>r.win===true).length,losses=trades.filter(r=>r.win===false).length,ties=trades.filter(r=>r.win===null).length;
 const eligible=wins+losses,n=eligible,p=wins/Math.max(1,n),z=1.96;
 const denom=1+z*z/Math.max(1,n),mid=(p+z*z/(2*Math.max(1,n)))/denom;
 const lower=n?(mid-z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denom):0;
 return {count:trades.length,wins,losses,ties,winRate:n?100*p:null,netUnits:+(wins*payout/100-losses).toFixed(4),
   lower95:n?lower*100:null,conservativeEV:n?(lower*(1+payout/100)-1):null};
};
export function discoverStrategies(raw,{tf=30,expiry=30,payout=85,now=Date.now()/1000,minEvidence=100}={}){
 if(![5,15,30,60].includes(tf)||![15,20,30,60].includes(expiry)||expiry%tf!==0)return {error:'Choose a valid expiration divisible by candle duration'};
 if(!(payout>0&&payout<=100))return {error:'Payout must be 1–100%'};
 const {bars,report}=auditRawCandles(raw,tf,now),horizon=expiry/tf;
 if(bars.length<240+horizon)return {error:`Need at least 240 completed candles, got ${bars.length}`,quality:report};
 const pivot1=Math.floor(bars.length*.6),pivot2=Math.floor(bars.length*.8);
 const results=new Map(CANDIDATES.map(c=>[c.id,{development:[],validation:[],holdout:[]}]));
 const lastTradeIndex=new Map(CANDIDATES.map(c=>[c.id,-100]));
 for(let i=50;i+horizon<bars.length;i++){
  if(i+horizon>=pivot1&&i<pivot1||i+horizon>=pivot2&&i<pivot2)continue;
  let contiguous=true;for(let j=i-50;j<=i+horizon;j++)if(j>i-50&&bars[j].time-bars[j-1].time!==tf){contiguous=false;break;}
  if(!contiguous)continue;
  const f=context(bars,i);if(!f)continue;
  const predictions=sides(f),part=i<pivot1?'development':i<pivot2?'validation':'holdout';
  const entry=bars[i+1].open,exit=bars[i+horizon].close;
  for(const candidate of CANDIDATES){
   const side=predictions[candidate.id];if(!side||i<=lastTradeIndex.get(candidate.id))continue;
   const win=entry===exit?null:side==='CALL'?exit>entry:exit<entry;
   results.get(candidate.id)[part].push({time:bars[i].time,side,win});
   lastTradeIndex.set(candidate.id,i+horizon); // don't inflate evidence with overlapping expiries
  }
 }
 const rows=CANDIDATES.map(c=>{
  const x=results.get(c.id),development=stats(x.development,payout),validation=stats(x.validation,payout),holdout=stats(x.holdout,payout);
  return {id:c.id,name:c.name,development,validation,holdout,
  validationEligible:validation.wins+validation.losses>=30&&validation.netUnits>0&&validation.conservativeEV>0,
  verified:false,executionMode:'RESEARCH ONLY',reason:'Holdout is a diagnostic, not authorization for live orders'};
 });
 // Choose candidate by its validation score ONLY. Never train/select based on holdout performance.
 const ranked=[...rows].sort((a,b)=>(b.validation.conservativeEV??-1e6)-(a.validation.conservativeEV??-1e6));
 const provisional=ranked.find(r=>r.validationEligible)||null;
 const holdoutReady=!!provisional&&provisional.holdout.wins+provisional.holdout.losses>=minEvidence&&provisional.holdout.conservativeEV>0;
 return {quality:report,tf,expiry,payout,breakEven:100/(1+payout/100),candidates:ranked,
  provisionalChampion:provisional?.name||null,championId:provisional?.id||null,
  readyForForwardDemo:holdoutReady&&report.days>=7&&report.gapRuns===0,
  decision:'RESEARCH ONLY — no live ML trade authorization',
  limitations:'One partitioned sample; many candidate strategies tested. Out-of-sample forward data and broker-price verification required. No broker fill or latency is modeled.'};
}
