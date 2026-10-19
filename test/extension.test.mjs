import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const project = new URL('../extension/', import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',project),'utf8'));
test('Chrome widget is scoped to Pocket Option, no generic web injection',()=>{
 assert.equal(manifest.manifest_version,3);
 const patterns=manifest.content_scripts.flatMap(x=>x.matches);
 assert.ok(patterns.some(p=>p.includes('pocketoption.com')));
 assert.equal(patterns.some(p=>p.includes('<all_urls>')),false);
 assert.equal(manifest.permissions.includes('tabs'),false);
});
test('extension has no broker order or login permissions',async()=>{
 const script=await readFile(new URL('background.js',project),'utf8');
 assert.equal(/SSID|placeOrder|purchaseContract|authorizeBroker|passwordBroker/i.test(script),false);
 assert.ok(script.includes("x-scanner-code"));
});
test('extension never triggers polling automatically in the content script',async()=>{
 const content=await readFile(new URL('content.js',project),'utf8');
 assert.ok(content.includes("$('scan').addEventListener('click'"));
 assert.ok(!content.includes('setInterval('));
 assert.ok(content.includes('not broker-verified'));
});
