import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextDue,nextDailyWindow,nextRecommended,archiveHealth} from '../public/free-schedule.mjs';
test('30-second snapshots never recommend before four-hour cooldown',()=>{
 const now=Date.UTC(2026,9,19,10);const last=now-2*3600000;
 assert.equal(nextDue(last,30,now),now+2*3600000);
 assert.equal(nextRecommended(last,30,now),Date.UTC(2026,9,19,16));
});
test('recommended daily windows rotate across midnight',()=>{
 assert.equal(nextDailyWindow(Date.UTC(2026,9,19,17)),Date.UTC(2026,9,20,0));
});
test('60-second interval respects longer cooldown',()=>{
 const now=Date.UTC(2026,9,19,12),last=now-1*3600000;
 assert.equal(nextDue(last,60,now),last+36*3600000);
});
test('archive audit identifies real gaps',()=>{
 const result=archiveHealth([{time:60},{time:90},{time:180}],30,240);
 assert.equal(result.gaps,1);assert.equal(result.missing,2);assert.match(result.warning,/missing/);
});
