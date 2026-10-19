/** Market Shaker AI v4: research-only OTC directional classifier.
 * Uses 60% oldest candles for training, next 20% for diagnostics, newest 20% as a holdout.
 * Never issues a live order or claims calibrated win probability. No network or API calls.
 */
import {cleanBars} from './strategies.mjs';
import {ema,rsi} from './scanner.mjs';
const sigmoid = x => 1/(1+Math.exp(-Math.max(-30,Math.min(30,x))));
const avg = x => x.reduce((s,v)=>s+v,0)/x.length;
const clip = (n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const features = (bars,i)=>{
 if(i<35)return null;
 const b=bars.slice(i-35,i+1),prices=b.map(x=>x.close),last=b.at(-1),previous=b.at(-2),third=b.at(-4);
 const trueRanges=b.slice(-14).map((c,j,a)=>{
  const p=j?a[j-1].close:c.open;
  return Math.max(c.high-c.low,Math.abs(c.high-p),Math.abs(c.low-p));
 });
 const atr=avg(trueRanges);if(!(atr>0))return null;
 const range=Math.max(1e-10,last.high-last.low);
 return [clip((last.close-third.close)/atr,-5,5),clip((last.close-previous.close)/atr,-5,5),
  clip((ema(prices,9)-ema(prices,21))/atr,-5,5),(rsi(prices,14)-50)/50,
  (last.close-last.open)/range,(last.close-last.low)/range-.5,clip(range/atr,0,3)-1];
};
const continuous=(bars,a,b,tf)=>{for(let i=a+1;i<=b;i++)if(bars[i].time-bars[i-1].time!==tf)return false;return true;};
function fit(rows){
 const d=rows[0].x.length,n=rows.length;
 const mu=Array.from({length:d},(_,j)=>avg(rows.map(r=>r.x[j])));
 const sd=Array.from({length:d},(_,j)=>Math.max(.0001,Math.sqrt(avg(rows.map(r=>(r.x[j]-mu[j])**2)))));
 const norm=x=>x.map((v,j)=>clip((v-mu[j])/sd[j],-5,5));
 const w=Array(d+1).fill(0),all=rows.map(r=>({x:norm(r.x),y:r.y}));
 for(let epoch=0;epoch<550;epoch++){
  const g=Array(d+1).fill(0);
  for(const r of all){const p=sigmoid(w[0]+r.x.reduce((s,v,j)=>s+v*w[j+1],0));const e=p-r.y;g[0]+=e;for(let j=0;j<d;j++)g[j+1]+=e*r.x[j];}
  w[0]-=.13*g[0]/n;
  for(let j=0;j<d;j++)w[j+1]-=.13*(g[j+1]/n+.09*w[j+1]);
 }
 return x=>sigmoid(w[0]+norm(x).reduce((s,v,j)=>s+v*w[j+1],0));
}
function evaluate(rows,model,threshold,payout){
 let wins=0,losses=0,skipped=0,ties=0,scoreMin=1,scoreMax=0,scoreTotal=0;
 for(const r of rows){
  const p=model(r.x),strength=Math.max(p,1-p);scoreMin=Math.min(strength,scoreMin);scoreMax=Math.max(strength,scoreMax);scoreTotal+=strength;
  const side=p>=threshold?'CALL':p<=1-threshold?'PUT':null;
  if(!side){skipped++;continue;}if(r.y===null){ties++;continue;}
  if((side==='CALL')===(r.y===1))wins++;else losses++;
 }
 const signals=wins+losses;
 return {samples:rows.length,wins,losses,skipped,ties,signals,
  winRate:signals?100*wins/signals:null,netUnits:wins*payout/100-losses,
  scoreMin:rows.length?scoreMin*100:null,scoreMax:rows.length?scoreMax*100:null,
  scoreMean:rows.length?scoreTotal/rows.length*100:null};
}
export function researchScan(raw,tf=30,expiry=30,payout=85,now=Math.floor(Date.now()/1000)){
 if(![5,15,30,60].includes(tf)||![15,20,30,60].includes(expiry)||expiry%tf!==0)return {error:'Select an expiry divisible by the candle interval'};
 if(!Number.isFinite(payout)||payout<1||payout>100)return {error:'Enter a payout between 1% and 100%'};
 const bars=cleanBars(raw,tf,now),horizon=expiry/tf;
 if(bars.length<240+horizon)return {error:'Need at least 240 complete candles to train and test without reusing future outcomes'};
 const pivot1=Math.floor(bars.length*.60),pivot2=Math.floor(bars.length*.80),train=[],validation=[],holdout=[];
 for(let i=35;i+horizon<bars.length;i++){
  if(!continuous(bars,i-35,i+horizon,tf))continue;
  const x=features(bars,i);if(!x)continue;
  const entry=bars[i+1].open,exit=bars[i+horizon].close;
  const r={x,y:exit===entry?null:exit>entry?1:0,i};
  if(i+horizon<pivot1)train.push(r);else if(i>=pivot1&&i+horizon<pivot2)validation.push(r);else if(i>=pivot2)holdout.push(r);
 }
 const validTrain=train.filter(r=>r.y!==null);
 if(validTrain.length<120||validation.length<30||holdout.length<30)return {error:`Insufficient continuous training/testing samples: ${validTrain.length} / ${validation.length} / ${holdout.length}. Collect more candles.`};
 if(validTrain.filter(r=>r.y===1).length<20||validTrain.filter(r=>r.y===0).length<20)return {error:'Insufficient up/down examples to train a balanced model'};
 const model=fit(validTrain),breakEven=100/(1+payout/100),threshold=Math.max(.62,1/(1+payout/100)+.06);
 const val=evaluate(validation,model,threshold,payout),test=evaluate(holdout,model,threshold,payout);
 const last=bars.at(-1),fresh=now-(last.time+tf)<=Math.max(12,tf+4);
 const recentContinuous=bars.length>=36&&continuous(bars,bars.length-36,bars.length-1,tf);
 const x=features(bars,bars.length-1);const p=x?model(x):null;
 const bias=p===null?null:p>=.5?'CALL':'PUT',biasScore=p===null?null:100*Math.max(p,1-p);
 const scorePass=p!==null&&Math.max(p,1-p)>=threshold;
 // With 500 candles, 100 confirmed HOLDOUT signals is unlikely. Fail closed for live alerts.
 const evidenceSufficient=val.signals>=100&&test.signals>=100&&val.winRate>breakEven+3&&test.winRate>breakEven+3&&val.netUnits>0&&test.netUnits>0;
 let reason='';
 if(!recentContinuous)reason='Recent data contains gaps; no live entry permitted.';
 else if(!fresh)reason='Latest candle is stale. A saved dataset is for research, not entry.';
 else if(!scorePass)reason='Model did not pass its predefined directional score cutoff.';
 else if(!evidenceSufficient)reason='Insufficient independent historical evidence; research only.';
 else reason='Historical checks passed, but forward demo validation is still required.';
 return {kind:'AI_RESEARCH_V4',trade:'NO TRADE',researchBias:bias,researchScore:biasScore,
  uncalibrated:true,threshold:threshold*100,breakEven,trainingCount:validTrain.length,
  validation:val,holdout:test,earliestTime:bars[0].time,latestTime:last.time,
  latestCandleFresh:fresh,recentContinuous,evidenceSufficient,scorePass,
  reason,barCount:bars.length,tf,expiry,payout,
  note:'Research only. Model scores are uncalibrated and not win probabilities. Assumes ideal next-candle entries, excludes latency and broker settlement. No automatic trading.'};
}
