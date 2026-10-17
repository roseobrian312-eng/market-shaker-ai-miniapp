import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCandles,ema,rsi,MARKETS} from '../public/scanner.mjs';
const now=1_780_000_000;
function candles(direction=1, count=60, tf=60){return Array.from({length:count},(_,i)=>{const close=1.2+direction*(i*.0002+Math.sin(i*1.8)*.0006),open=close-direction*.00013;return {time:now-(count-i)*tf-5,open,close,high:Math.max(open,close)+.00002,low:Math.min(open,close)-.00002}})}
test('EMA on constant values',()=>assert.ok(Math.abs(ema(Array(35).fill(7),9)-7)<1e-9));
test('RSI on constant values is neutral',()=>assert.equal(rsi(Array(35).fill(7)),50));
test('Market whitelist uses five instruments',()=>assert.equal(MARKETS.length,5));
test('Bullish closed candles produce CALL',()=>assert.equal(analyzeCandles(candles(1),60,now).side,'CALL'));
test('Bearish closed candles produce PUT',()=>assert.equal(analyzeCandles(candles(-1),60,now).side,'PUT'));
test('Stale prices never produce a signal',()=>assert.equal(analyzeCandles(candles(1),60,now+500).status,'stale'));
test('An incomplete latest candle is ignored',()=>{let c=candles(1);c.push({...c.at(-1),time:now-10,open:1,close:0.1,high:1,low:.1});assert.equal(analyzeCandles(c,60,now).side,'CALL')});
test('Reported closed market cannot issue signal',()=>assert.equal(analyzeCandles(candles(1),60,now,{open:false}).status,'closed'));
test('Candle gaps prevent entry signals',()=>{let c=candles(1);c[45].time+=1;assert.equal(analyzeCandles(c,60,now).status,'gap')});
test('Missing market data never produces a signal',()=>assert.equal(analyzeCandles([],60,now).side,null));
