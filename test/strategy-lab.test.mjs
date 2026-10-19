import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSmart,cleanBars,classify,backtest} from '../public/strategies.mjs';
const now=1_800_000_000;
const generate=(len=600,tf=30)=>Array.from({length:len},(_,i)=>{
  const close=1.2+i*.000001+Math.sin(i*.29)*.0002;
  const open=1.2+(i-1)*.000001+Math.sin((i-1)*.29)*.0002;
  return {time:now-(len-i)*tf-2,open,close,high:Math.max(open,close)+.000014,low:Math.min(open,close)-.000014};
});
test('cleanBars ignores unfinished candles',()=>{
 const arr=generate(160);arr.push({...arr.at(-1),time:now-10});
 assert.equal(cleanBars(arr,30,now).length,160);
});
test('real-time scanner suppresses stale short-expiry candle alerts',()=>{
 assert.equal(analyzeSmart(generate(140),30,now+200).status,'stale');
});
test('real-time scanner rejects gaps',()=>{
 const arr=generate(140);arr[130].time+=1;
 assert.equal(analyzeSmart(arr,30,now).status,'gap');
});
test('classifier makes no prediction before lookback',()=>{
 assert.equal(classify(generate(70),10,'pullback').side,null);
});
test('backtest rejects misaligned expiry',()=>{
 assert.ok(backtest(generate(),30,20,'pullback',85,now).error);
});
test('backtest results separate development and holdout, and do not claim a live track record',()=>{
 const result=backtest(generate(600),30,30,'baseline',85,now);
 assert.equal(result.bars,600);
 assert.equal(result.expiry,30);
 assert.ok(result.development.signals>=0);
 assert.ok(result.holdout.signals>=0);
 assert.ok(Math.abs(result.breakEven - 100/1.85) < 0.001);
 assert.ok(result.records.every(x=>x.split==='development'||x.split==='holdout'));
 assert.ok(result.disclaimer.includes('Not actual broker trades'));
});
