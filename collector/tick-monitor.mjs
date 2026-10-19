/** Incremental tick aggregation / research-only pattern candidate monitor. */
export class TickMonitor{
 constructor(symbols){this.symbols=new Map(symbols.map(s=>[s,{symbol:s,lastPrice:null,lastTime:null,lastReceive:0,count:0,ticks:[],candles:[],active:null}]));this.candidates=[]}
 observe({symbol,price,time,receivedAt=Date.now()}){
  const s=this.symbols.get(symbol);if(!s||!Number.isFinite(price)||!Number.isFinite(time))return;
  s.count++;s.lastPrice=price;s.lastReceive=receivedAt;
  // Prevent unordered timestamps from generating apparent momentum sequences.
  if(s.lastTime!==null&&time<s.lastTime)return;
  if(s.lastTime===time&&s.ticks.length&&s.ticks.at(-1).price===price)return;
  if(s.lastTime!==null&&time-s.lastTime>10)s.ticks=[]; // gap invalidates tick-window candidates
  s.lastTime=time;s.ticks.push({price,time});
  while(s.ticks.length>2000||s.ticks.length&&time-s.ticks[0].time>180)s.ticks.shift();
  const period=Math.floor(time/5)*5;
  if(!s.active||s.active.time!==period){
   if(s.active){s.candles.push(s.active);if(s.candles.length>300)s.candles.shift()}
   s.active={time:period,open:price,high:price,low:price,close:price,count:1};
  }else{s.active.high=Math.max(s.active.high,price);s.active.low=Math.min(s.active.low,price);s.active.close=price;s.active.count++}
  const before=seconds=>{for(let i=s.ticks.length-1;i>=0;i--)if(time-s.ticks[i].time>=seconds)return s.ticks[i].price;return null};
  const p10=before(10),p30=before(30);
  if(p10===null||p30===null||s.ticks.length<20)return;
  const r10=(price-p10)/p10,r30=(price-p30)/p30;
  if(!Number.isFinite(r10)||!Number.isFinite(r30))return;
  // Candidate markers are descriptive only; never sold as validated trade edges.
  const same=Math.sign(r10)===Math.sign(r30),stable=Math.abs(r10)>0.00005&&Math.abs(r10)<0.005;
  if(same&&stable&&(!s.lastCandidateAt||time-s.lastCandidateAt>=30)){
   s.lastCandidateAt=time;
   this.candidates.push({symbol,time,expiry:30,label:'Momentum agreement',direction:r10>0?'CALL':'PUT',reason:'10s/30s movement aligned (UNVALIDATED)'});
   if(this.candidates.length>50)this.candidates.shift();
  }
 }
 summary(){return Array.from(this.symbols.values()).map(s=>({symbol:s.symbol,count:s.count,lastPrice:s.lastPrice,ageSeconds:s.lastReceive?Math.round((Date.now()-s.lastReceive)/1000):null,complete5SecondCandles:s.candles.length}))}
 recentSignals(){return this.candidates.slice(-25)}
}
