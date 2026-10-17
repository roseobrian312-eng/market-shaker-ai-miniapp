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
