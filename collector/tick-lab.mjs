/** Evaluate tick-direction hypotheses, using timestamps and simulated entry delay.
 * Inputs are 1-second last-price samples from *recorded* ticks, with no future info in features.
 * Results are hypothetical, not broker-verified, and never authorize live orders.
 */
const upperBound=(ticks,target)=>{let lo=0,hi=ticks.length;while(lo<hi){const mid=(lo+hi)>>1;if(ticks[mid].time<target)lo=mid+1;else hi=mid;}return lo;};
const n=z=>Number.isFinite(z);
const stats=(rows,payout)=>{
 const wins=rows.filter(x=>x.won).length,losses=rows.filter(x=>!x.won).length,total=wins+losses;
 const p=total?wins/total:0,z=1.96,denom=1+z*z/(total||1),mid=(p+z*z/(2*(total||1)))/denom;
 const lower=total?(mid-z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/denom):0;
 return {trades:total,wins,losses,winRate:total?100*p:null,netUnits:+(wins*payout/100-losses).toFixed(2),wilsonLower:total?lower*100:null,
  conservativeEV:total?lower*(1+payout/100)-1:null};
};
export function evaluateTickStrategies(input,{payout=85,expiry=30,entryDelay=2,minHoldout=100}={}){
 if(![15,20,30,60].includes(expiry)||![0,1,2,3,4].includes(entryDelay)||!n(payout)||payout<=0||payout>100)return {error:'Invalid expiry, delay or payout'};
 const ticks=[...input].filter(t=>n(t.time)&&n(t.price)&&t.price>0).sort((a,b)=>a.time-b.time);
 const timestamps=[];const clean=[];
 for(const t of ticks)if(!clean.length||t.time>clean.at(-1).time){clean.push(t);timestamps.push(t.time)}else if(t.time===clean.at(-1).time)clean[clean.length-1]=t;
 if(clean.length<500||clean.at(-1).time-clean[0].time<3600)return {error:'Need at least 500 one-second samples across an hour of real market movement'};
 const specs=['momentum_5_20','exhaustion_reversal','channel_breakout_30','volatility_reversion','momentum_breakout_hybrid'];
 const rows=new Map(specs.map(s=>[s,[]]));const lastSignal=new Map(specs.map(s=>[s,-Infinity]));
 const pivot1=clean[0].time+(clean.at(-1).time-clean[0].time)*.60,pivot2=clean[0].time+(clean.at(-1).time-clean[0].time)*.80;
 let lastBucket=-Infinity,skippedGaps=0,noQuotes=0;
 for(let i=0;i<clean.length;i++){
  const tick=clean[i],time=tick.time,bucket=Math.floor(time/5);
  if(bucket===lastBucket||time-clean[0].time<65)continue;lastBucket=bucket;
  const priceAt=(ago)=>{const j=upperBound(clean,time-ago+1)-1;return j>=0&&time-clean[j].time-ago<=2&&Math.abs(time-clean[j].time-ago)<=2?clean[j].price:null};
  const p5=priceAt(5),p20=priceAt(20),p30=priceAt(30),p60=priceAt(60);
  if([p5,p20,p30,p60].some(x=>x===null)){skippedGaps++;continue}
  const d5=(tick.price-p5)/p5,d20=(tick.price-p20)/p20,d30=(tick.price-p30)/p30;
  const scale=Math.max(1e-10,Math.abs((tick.price-p60)/p60));
  const channelLo=Math.min(p5,p20,p30,p60),channelHi=Math.max(p5,p20,p30,p60);
  const mom=Math.sign(d5)===Math.sign(d20)&&Math.abs(d5)>.000025?Math.sign(d20):0;
  const shortReverse=Math.sign(d5)!==Math.sign(d30)&&Math.abs(d30)>.00007&&Math.abs(d5)>.000018?-Math.sign(d30):0;
  const breakout=tick.price>channelHi&&d5>.000025?1:tick.price<channelLo&&d5<-.000025?-1:0;
  const meanRev=Math.abs(d30)>Math.max(.00013,scale*1.3)&&Math.sign(d5)!==Math.sign(d30)?-Math.sign(d30):0;
  const signals={momentum_5_20:mom,exhaustion_reversal:shortReverse,channel_breakout_30:breakout,
   volatility_reversion:meanRev,momentum_breakout_hybrid:mom!==0&&mom===breakout?mom:0};
  for(const [id,side] of Object.entries(signals)){
   if(!side||time-lastSignal.get(id)<expiry)continue;
   // Fill starts after research-only simulated network/manual-entry delay.
   const entryIndex=upperBound(clean,time+entryDelay),entry=clean[entryIndex];
   if(!entry||entry.time-(time+entryDelay)>2){noQuotes++;continue}
   const settleIndex=upperBound(clean,entry.time+expiry),settle=clean[settleIndex];
   if(!settle||settle.time-(entry.time+expiry)>2){noQuotes++;continue}
   const stage=time<pivot1?'development':time<pivot2?'validation':'holdout';
   if((stage==='development'&&settle.time>=pivot1)||(stage==='validation'&&settle.time>=pivot2))continue;
   if(entry.price===settle.price)continue;
   const won=side===1?settle.price>entry.price:settle.price<entry.price;
   rows.get(id).push({won,time});lastSignal.set(id,time);
  }
 }
 const rankings=specs.map(id=>{
  const x=rows.get(id),split=(s)=>x.filter(t=>t.time<s[1]&&t.time>=s[0]),development=stats(split([-Infinity,pivot1]),payout),validation=stats(split([pivot1,pivot2]),payout),holdout=stats(split([pivot2,Infinity]),payout);
  return {id,development,validation,holdout,brokerVerified:false};
 }).sort((a,b)=>(b.validation.conservativeEV??-10000)-(a.validation.conservativeEV??-10000));
 const leader=rankings.find(r=>r.validation.trades>=40&&r.validation.conservativeEV>0);
 return {dataPoints:clean.length,start:clean[0].time,end:clean.at(-1).time,expiry,entryDelay,payout,skippedGaps,noQuotes,rankings,
  candidateFromValidation:leader?.id||null,
  strongIndependentEvidence:!!leader&&leader.holdout.trades>=minHoldout&&leader.holdout.conservativeEV>0,
  action:'NO AUTOMATIC TRADING',notice:'Hypothetical tick outcomes at observed prices after assumed entry delay; no Pocket Option order/settlement verification. Multiple-model search inflates apparent edges.'};
}
