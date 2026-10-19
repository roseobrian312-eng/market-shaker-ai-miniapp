/** Historical ML research only. A logistic-regression classifier trained on observed candles.
 * No external AI API, no online trading, no claimed predictive edge. Chronological holdout.
 */
import {cleanBars} from './strategies.mjs';
import {ema,rsi} from './scanner.mjs';
const logistic=z=>1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));
const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;
function features(bars,i){
 if(i<35)return null;
 const recent=bars.slice(i-35,i+1),close=recent.map(c=>c.close),last=recent.at(-1),prior=recent.at(-2),c3=recent.at(-4);
 const atr=mean(recent.slice(-14).map((b,j,a)=>Math.max(b.high-b.low,Math.abs(b.high-(j?a[j-1].close:b.open)),Math.abs(b.low-(j?a[j-1].close:b.open)))));
 if(!Number.isFinite(atr)||atr<=0)return null;
 const e9=ema(close,9),e21=ema(close,21),strength=rsi(close,14),range=Math.max(last.high-last.low,1e-10);
 return [
   Math.max(-5,Math.min(5,(last.close-c3.close)/atr)),
   Math.max(-5,Math.min(5,(last.close-prior.close)/atr)),
   Math.max(-5,Math.min(5,(e9-e21)/atr)),
   (strength-50)/50,
   (last.close-last.open)/range,
   (last.close-last.low)/range-.5,
   Math.min(3,range/atr)-1
 ];
}
function contiguous(bars,start,end,tf){for(let i=start+1;i<=end;i++)if(bars[i].time-bars[i-1].time!==tf)return false;return true;}
function fitLogistic(rows){
 const n=rows.length,d=rows[0].x.length;
 const mu=Array.from({length:d},(_,j)=>mean(rows.map(r=>r.x[j])));
 const sd=Array.from({length:d},(_,j)=>Math.max(0.0001,Math.sqrt(mean(rows.map(r=>(r.x[j]-mu[j])**2)))));
 const norm=x=>x.map((v,j)=>Math.max(-5,Math.min(5,(v-mu[j])/sd[j])));
 const w=Array(d+1).fill(0),train=rows.map(r=>({x:norm(r.x),y:r.y}));
 // Full batch gradient descent on regularized binary cross-entropy; deterministic.
 for(let epoch=0;epoch<650;epoch++){
   const gradient=Array(d+1).fill(0);
   for(const r of train){const p=logistic(w[0]+r.x.reduce((s,v,j)=>s+v*w[j+1],0));const error=p-r.y;gradient[0]+=error;for(let j=0;j<d;j++)gradient[j+1]+=error*r.x[j];}
   const step=.14;w[0]-=step*gradient[0]/n;
   for(let j=0;j<d;j++)w[j+1]-=step*(gradient[j+1]/n+.08*w[j+1]);
 }
 return x=>logistic(w[0]+norm(x).reduce((sum,v,j)=>sum+v*w[j+1],0));
}
export function trainResearchModel(raw,tf=30,expiry=30,payout=85,now=Math.floor(Date.now()/1000)){
 if(![5,15,30,60].includes(tf)||![15,20,30,60].includes(expiry)||expiry%tf!==0)return {error:'Expiration must be divisible by the candle size'};
 if(!Number.isFinite(payout)||payout<=0||payout>100)return {error:'Enter a payout between 1 and 100 percent'};
 const bars=cleanBars(raw,tf,now),horizon=expiry/tf;
 if(bars.length<170+horizon)return {error:'Need at least 170 completed candles and the expiry horizon for meaningful ML research'};
 const pivot=Math.floor(bars.length*.7),rows=[];
 for(let i=35;i+horizon<bars.length;i++){
   if(i<pivot&&i+horizon>=pivot)continue; // purge training outcomes crossing the holdout boundary
   if(!contiguous(bars,i-35,i+horizon,tf))continue;
   const x=features(bars,i);if(!x)continue;
   const entry=bars[i+1].open,exit=bars[i+horizon].close;
   if(entry===exit)continue; // ties excluded from binary classification
   rows.push({x,y:exit>entry?1:0,entry,exit,i});
 }
 const train=rows.filter(r=>r.i<pivot),holdout=rows.filter(r=>r.i>=pivot);
 if(train.length<90||holdout.length<30)return {error:`Insufficient contiguous labeled candles (${train.length} training, ${holdout.length} holdout)`};
 if(train.filter(r=>r.y===1).length<15||train.filter(r=>r.y===0).length<15)return {error:'Insufficient examples of both up and down outcomes'};
 const model=fitLogistic(train),breakeven=1/(1+payout/100),threshold=Math.max(.62,breakeven+.06);
 let wins=0,losses=0,skipped=0;
 for(const r of holdout){
   const p=model(r.x),side=p>=threshold?'CALL':p<=1-threshold?'PUT':null;
   if(!side){skipped++;continue;}
   const won=(side==='CALL')===(r.y===1);if(won)wins++;else losses++;
 }
 const signals=wins+losses;
 return {kind:'logistic-regression',trainCount:train.length,holdoutCount:holdout.length,holdoutSignals:signals,wins,losses,skipped,
   winRate:signals?100*wins/signals:null,netUnits:(wins*payout/100)-losses,threshold,breakeven:breakeven*100,
   validated:false,eligibleForLiveSignals:false,
   note:'A trainable statistical ML model. Results are modeled next-candle fills on a fixed historical holdout; they are NOT real trades or validated future accuracy. No signal is enabled for live trading.'};
}
