import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoverStrategies,auditRawCandles,CANDIDATES} from '../public/discovery-v5.mjs';
import {TickMonitor} from '../collector/tick-monitor.mjs';
import {evaluateTickStrategies} from '../collector/tick-lab.mjs';
const t0=1760000000;
function bars(n=850,tf=30){let price=1.2;return Array.from({length:n},(_,i)=>{
 let open=price;price+=Math.sin(i*.3)*.00015+Math.sin(i*.7)*.00010;
 return {time:t0+i*tf,open,high:Math.max(open,price)+.00008,low:Math.min(open,price)-.00008,close:price};
})}
test('strategy discovery has diverse candidates including hybrids',()=>{assert.ok(CANDIDATES.length>=8);assert.ok(CANDIDATES.some(x=>x.id.includes('hybrid')))});
test('strategy lab detects duplicates and missing bars',()=>{let b=bars(300);b.splice(200,4);b.push({...b[4]});let r=auditRawCandles(b,30,1800000000);assert.equal(r.report.duplicates,1);assert.equal(r.report.missingBars,4)});
test('strategy lab preserves separate development validation and holdout',()=>{const r=discoverStrategies(bars(),{tf:30,expiry:30,payout:85,now:1800000000});assert.ok(!r.error,r.error);assert.equal(r.candidates.length,CANDIDATES.length);for(const row of r.candidates){assert.ok(row.development);assert.ok(row.validation);assert.ok(row.holdout);assert.equal(row.executionMode,'RESEARCH ONLY')}assert.match(r.decision,/RESEARCH ONLY/)});
test('strategy lab rejects incompatible research expirations',()=>{assert.match(discoverStrategies(bars(),{tf:30,expiry:20}).error,/divisible/)});
test('tick collector emits at most one candidate per cooldown, without orders',()=>{
 const m=new TickMonitor(['EURUSD_otc']);const start=t0;
 for(let i=0;i<100;i++)m.observe({symbol:'EURUSD_otc',price:1.2+i*.00002,time:start+i,receivedAt:Date.now()});
 assert.equal(m.summary()[0].count,100);assert.ok(m.recentSignals().length<=4);
 for(const x of m.recentSignals())assert.equal(x.label,'Momentum agreement');
});
test('tick research refuses insufficient evidence',()=>{const r=evaluateTickStrategies(Array.from({length:100},(_,i)=>({time:t0+i,price:1+i/1000})));assert.match(r.error,/500/)});
test('tick lab partitions recorded ticks with entry latency and produces no real trade order',()=>{
 const a=Array.from({length:8000},(_,i)=>({time:t0+i,price:1.2+Math.sin(i*.25)*.0002+Math.sin(i*.007)*.001}));
 const r=evaluateTickStrategies(a,{payout:85,expiry:30,entryDelay:2});assert.ok(!r.error,r.error);assert.equal(r.rankings.length,5);assert.match(r.action,/NO AUTOMATIC/);
 for(const row of r.rankings){assert.ok(row.validation);assert.ok(row.holdout);assert.equal(row.brokerVerified,false)}
});
