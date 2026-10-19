import {test} from 'node:test';import assert from 'node:assert/strict';
import {trainResearchModel} from '../public/ml.mjs';
function bars(n=400,tf=30){const t=1_780_000_000;let price=1.0;return Array.from({length:n},(_,i)=>{const open=price;price+=Math.sin(i*.27)*.0001+Math.sin(i*2.1)*.00007;const close=price;return {time:t+i*tf,open,high:Math.max(open,close)+.00006,low:Math.min(open,close)-.00006,close}})}
test('research learner refuses insufficient observations',()=>{assert.match(trainResearchModel(bars(70),30,30,85,1_800_000_000).error,/170/)});
test('research learner rejects incompatible durations',()=>{assert.match(trainResearchModel(bars(),30,20,85,1_800_000_000).error,/divisible/)});
test('research learner never describes modeled results as verified broker wins',()=>{const r=trainResearchModel(bars(),30,30,85,1_800_000_000);assert.equal(r.kind,'logistic-regression');assert.equal(r.validated,false);assert.equal(r.eligibleForLiveSignals,false);assert.equal(r.wins+r.losses,r.holdoutSignals);assert.equal(r.skipped+r.holdoutSignals,r.holdoutCount);});
test('research learner rejects missing candle intervals',()=>{const source=bars();source.splice(110,85);const r=trainResearchModel(source,30,30,85,1_800_000_000);assert.ok(r.error||r.holdoutCount>0);});
