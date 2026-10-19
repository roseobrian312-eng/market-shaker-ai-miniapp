/** Offline batch research over recorded tick files; no OTCharts requests.
 * Usage: node collector/analyze.mjs [expiry=30] [payout=85]
 */
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {createReadStream as stream} from 'node:fs';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {evaluateTickStrategies} from './tick-lab.mjs';
import {discoverStrategies} from '../public/discovery-v5.mjs';
const directory=resolve(fileURLToPath(new URL('data/',import.meta.url)));
const payout=Number(process.argv[3]??85),expiry=Number(process.argv[2]??30);
let files=[];try{files=(await readdir(directory)).filter(f=>f.endsWith('.ndjson')).sort()}catch{console.log('No collector/data folder. Run record.mjs with a paid stream first.');process.exit(1)}
if(!files.length){console.log('No recorded tick files yet. Start the collector.');process.exit(1)}
const symbols=[...new Set(files.map(f=>f.split('-20')[0]))];
const results={created:new Date().toISOString(),expiry,payout,markets:{}};
for(const symbol of symbols){
 const second=[];let lastSecond=null,received=0,bad=0,duplicates=0,unordered=0;
 // Review one symbol at a time, stream NDJSON from disk, reduce data to per-second prices.
 for(const name of files.filter(f=>f.startsWith(symbol+'-20'))){
  const rl=createInterface({input:stream(join(directory,name)),crlfDelay:Infinity});
  for await(const line of rl){let v;try{v=JSON.parse(line)}catch{bad++;continue}
   if(v.symbol!==symbol||!Number.isFinite(v.time)||!Number.isFinite(v.price)||v.price<=0){bad++;continue}
   received++;const sec=Math.floor(v.time);
   if(lastSecond!==null&&sec<lastSecond){unordered++;continue}
   if(sec===lastSecond){duplicates++;second[second.length-1]={time:sec,price:v.price}}
   else{second.push({time:sec,price:v.price});lastSecond=sec}
  }
 }
 if(!second.length)continue;
 const bars=[];let active=null;
 for(const t of second){const bucket=Math.floor(t.time/30)*30;
  if(!active||active.time!==bucket){if(active)bars.push(active);active={time:bucket,open:t.price,high:t.price,low:t.price,close:t.price}}
  else{active.high=Math.max(active.high,t.price);active.low=Math.min(active.low,t.price);active.close=t.price}
 }
 if(active)bars.push(active);
 // Importable candle archive; save as local CSV without using any API requests.
 const reportDir=join(directory,'..','reports');await mkdir(reportDir,{recursive:true});
 const csv=join(reportDir,`${symbol}-30sec-candles.csv`);
 await writeFile(csv,'time,open,high,low,close\n'+bars.map(b=>`${b.time},${b.open},${b.high},${b.low},${b.close}`).join('\n'));
 const tick=evaluateTickStrategies(second,{payout,expiry,entryDelay:2});
 const candle=expiry%30===0?discoverStrategies(bars,{tf:30,expiry,payout}):{error:'Candle research needs 30s/60s expiry for 30s candles'};
 results.markets[symbol]={received,uniqueSeconds:second.length,duplicatesInSecond:duplicates,unorderedDropped:unordered,bad,
  recordedDays:new Set(second.map(t=>Math.floor(t.time/86400))).size,first:new Date(second[0].time*1000).toISOString(),last:new Date(second.at(-1).time*1000).toISOString(),
  tick,candle: candle.error ? candle : {quality:candle.quality,provisionalChampion:candle.provisionalChampion,candidates:candle.candidates,readyForForwardDemo:candle.readyForForwardDemo,decision:candle.decision}};
 console.log(`${symbol}: ${received} ticks, ${second.length} unique seconds, ${bars.length} 30-second candles; ${results.markets[symbol].recordedDays} calendar days`);
}
const outputDir=join(directory,'..','reports');await mkdir(outputDir,{recursive:true});
const output=join(outputDir,`market-shaker-research-${Date.now()}.json`);await writeFile(output,JSON.stringify(results,null,2));
console.log('Saved research report to '+output+'\nResearch results are hypothetical—not verified profitable trades.');
