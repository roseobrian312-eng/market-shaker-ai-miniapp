import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planSummary,suggestedMinimumSeconds,isDue,candleAudit,validateSnapshot} from '../public/free-collector-core.mjs';
test('plan status respects account response',()=>{
 const free=planSummary({plan:'free',requests:{used:12,quota:200,remaining:188,per:'month'},streams:{limit:0}});
 assert.equal(free.remaining,188);assert.equal(free.streams,0);assert.equal(free.period,'month');
});
test('spacing stops needless repeat snapshots',()=>{
 assert.equal(suggestedMinimumSeconds(30),4*3600);
 assert.equal(isDue(0,Date.now(),30),true);
 assert.equal(isDue(1000000,2000000,30),false);
});
test('data audit reports genuine gaps instead of inventing history',()=>{
 const x=candleAudit([{time:60},{time:90},{time:90},{time:180}],30);
 assert.equal(x.count,3);assert.equal(x.gaps,1);assert.equal(x.missing,2);
});
test('rejects wrong assets or invalid OHLC',()=>{
 const data={source:'OTCharts / Pocket Option OTC (independent feed)',symbol:'EURUSD_otc',tf:30,candles:[{time:1,open:1,high:1.1,low:.9,close:1.05}]};
 assert.equal(validateSnapshot(data,'EURUSD_otc',30),true);
 assert.equal(validateSnapshot(data,'GBPUSD_otc',30),false);
});
test('usage requires owner auth and calls only the usage endpoint',async()=>{
 const oldFetch=globalThis.fetch,oldCode=process.env.SCANNER_ACCESS_CODE,oldKey=process.env.OTCHARTS_API_KEY;
 const {default:handler}=await import('../netlify/functions/candles.mjs');
 try{
  process.env.SCANNER_ACCESS_CODE='test-only';process.env.OTCHARTS_API_KEY='test-provider';
  let calls=0;
  globalThis.fetch=async(url)=>{calls++;assert.equal(String(url),'https://otcharts.com/v1/usage');return new Response(JSON.stringify({plan:'free',requests:{remaining:87,quota:200},streams:{limit:0}}),{status:200})};
  const unauthorized=await handler(new Request('https://test.test/.netlify/functions/candles?usage=1'));
  assert.equal(unauthorized.status,401);assert.equal(calls,0);
  const authorized=await handler(new Request('https://test.test/.netlify/functions/candles?usage=1',{headers:{'x-scanner-code':'test-only'}}));
  assert.equal(authorized.status,200);assert.equal((await authorized.json()).requests.remaining,87);assert.equal(calls,1);
 }finally{
 globalThis.fetch=oldFetch;
 if(oldCode===undefined)delete process.env.SCANNER_ACCESS_CODE;else process.env.SCANNER_ACCESS_CODE=oldCode;
 if(oldKey===undefined)delete process.env.OTCHARTS_API_KEY;else process.env.OTCHARTS_API_KEY=oldKey;
 }
});
