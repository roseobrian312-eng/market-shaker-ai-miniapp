import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/candles.mjs';
test('rejects unknown market names before contacting provider', async()=>{
 const response=await handler(new Request('https://example.com/.netlify/functions/candles?symbol=FAKEPAIR_otc&tf=60'));
 assert.equal(response.status,400);assert.match((await response.json()).error,/Unsupported/);
});
test('rejects invalid timeframe before contacting provider', async()=>{
 const response=await handler(new Request('https://example.com/.netlify/functions/candles?symbol=EURUSD_otc&tf=1'));
 assert.equal(response.status,400);
});
test('no fake candles are returned without provider configuration', async()=>{
 const previous=process.env.OTCHARTS_API_KEY;
 delete process.env.OTCHARTS_API_KEY;
 const response=await handler(new Request('https://example.com/.netlify/functions/candles?symbol=EURUSD_otc&tf=60'));
 assert.equal(response.status,503);const body=await response.json();assert.ok(body.error);assert.ok(!body.candles);
 if(previous!==undefined)process.env.OTCHARTS_API_KEY=previous;
});
test('blocks public requests when the owner access code is absent',async()=>{
 const oldCode=process.env.SCANNER_ACCESS_CODE,oldKey=process.env.OTCHARTS_API_KEY;
 process.env.SCANNER_ACCESS_CODE='protected-owner-code';
 process.env.OTCHARTS_API_KEY='fake-for-test';
 const response=await handler(new Request('https://example.com/.netlify/functions/candles?symbol=EURUSD_otc&tf=30'));
 assert.equal(response.status,401);
 if(oldCode===undefined)delete process.env.SCANNER_ACCESS_CODE;else process.env.SCANNER_ACCESS_CODE=oldCode;
 if(oldKey===undefined)delete process.env.OTCHARTS_API_KEY;else process.env.OTCHARTS_API_KEY=oldKey;
});
test('allowed authorized request retrieves candles once and normalizes provider clock',async()=>{
 const oldCode=process.env.SCANNER_ACCESS_CODE,oldKey=process.env.OTCHARTS_API_KEY,oldFetch=globalThis.fetch;
 process.env.SCANNER_ACCESS_CODE='private-code';process.env.OTCHARTS_API_KEY='fake-for-test';
 let count=0,requestUrl;
 globalThis.fetch=async u=>{count++;requestUrl=String(u);return new Response(JSON.stringify({candles:[{time:1_800_007_200,open:1,close:2,high:2,low:1}],open:true,gaps:{runs:0,missingBars:0}}),{status:200,headers:{'content-type':'application/json'}})};
 try{
  const response=await handler(new Request('https://example.com/.netlify/functions/candles?symbol=EURUSD_otc&tf=5',{headers:{'x-scanner-code':'private-code'}}));
  const body=await response.json();
  assert.equal(response.status,200);assert.equal(count,1);assert.match(requestUrl,/limit=500/);assert.equal(body.candles[0].time,1_800_000_000);
 }finally{
  globalThis.fetch=oldFetch;
  if(oldCode===undefined)delete process.env.SCANNER_ACCESS_CODE;else process.env.SCANNER_ACCESS_CODE=oldCode;
  if(oldKey===undefined)delete process.env.OTCHARTS_API_KEY;else process.env.OTCHARTS_API_KEY=oldKey;
 }
});

test('password verification succeeds with zero external market-data requests',async()=>{
 const prevCode=process.env.SCANNER_ACCESS_CODE,prevKey=process.env.OTCHARTS_API_KEY,prevFetch=globalThis.fetch;
 process.env.SCANNER_ACCESS_CODE='testing-owner';process.env.OTCHARTS_API_KEY='testing-provider';
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Provider should not be contacted')};
 try{
  const correct=await handler(new Request('https://test.invalid/.netlify/functions/candles?verify=1',{headers:{'x-scanner-code':'testing-owner'}}));
  const body=await correct.json();assert.equal(correct.status,200);assert.equal(body.verified,true);assert.equal(calls,0);
  const wrong=await handler(new Request('https://test.invalid/.netlify/functions/candles?verify=1',{headers:{'x-scanner-code':'not-correct'}}));
  assert.equal(wrong.status,401);assert.equal(calls,0);
 }finally{
  globalThis.fetch=prevFetch;
  if(prevCode===undefined)delete process.env.SCANNER_ACCESS_CODE;else process.env.SCANNER_ACCESS_CODE=prevCode;
  if(prevKey===undefined)delete process.env.OTCHARTS_API_KEY;else process.env.OTCHARTS_API_KEY=prevKey;
 }
});
