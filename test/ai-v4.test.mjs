import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchScan} from '../public/ai-v4.mjs';
const now=1_800_000_000;
function candles(n=500,tf=30){
 let p=1.05;return Array.from({length:n},(_,i)=>{
  const open=p;
  p+=Math.sin(i*.37)*.00012+Math.sin(i*.13)*.00009+Math.cos(i*.67)*.00004;
  const close=p;
  return {time:now-(n-i)*tf-2,open,high:Math.max(open,close)+.00003,low:Math.min(open,close)-.00003,close};
 });
}
test('v4 research trains without declaring an executable trade',()=>{
 const x=researchScan(candles(),30,30,85,now);
 assert.equal(x.kind,'AI_RESEARCH_V4');assert.equal(x.trade,'NO TRADE');
 assert.ok(x.trainingCount>=120);assert.ok(x.validation.samples>=30);assert.ok(x.holdout.samples>=30);
 assert.equal(x.holdout.wins+x.holdout.losses+x.holdout.skipped+x.holdout.ties,x.holdout.samples);
 assert.ok(x.researchBias==='CALL'||x.researchBias==='PUT');
 assert.ok(x.researchScore>=50&&x.researchScore<=100);
 assert.equal(x.uncalibrated,true);
});
test('v4 returns same prediction for same fixed dataset',()=>{
 const b=candles(),a=researchScan(b,30,30,85,now),z=researchScan(b,30,30,85,now);
 assert.deepEqual(a,z);
});
test('v4 refuses insufficient candles and incompatible expiry',()=>{
 assert.match(researchScan(candles(80),30,30,85,now).error,/240/);
 assert.match(researchScan(candles(),30,20,85,now).error,/divisible/);
});
test('v4 refuses when missing contiguous 30-sec bars create too few examples',()=>{
 const bars=candles().filter((_,i)=>i%2===0);
 assert.match(researchScan(bars,30,30,85,now).error,/Insufficient/);
});
test('v4 saved/stale data is never an actionable signal',()=>{
 const old=candles().map(b=>({...b,time:b.time-86400}));const x=researchScan(old,30,30,85,now);
 assert.equal(x.trade,'NO TRADE');assert.equal(x.latestCandleFresh,false);
 assert.match(x.reason,/stale/);
});
test('v4 does not leak outcomes across chronological train/validation boundaries',()=>{
 const z=researchScan(candles(),30,60,85,now);
 assert.equal(z.trade,'NO TRADE');assert.ok(z.trainingCount+z.validation.samples+z.holdout.samples<500);
});
