/** Attended local OTC tick recorder. Node 22+, no third-party packages.
 * Requires an OTCharts plan with /v1/stream. Does NOT trade or access Pocket Option.
 * Writes newline-delimited JSON into collector/data; API key remains in process env.
 */
import {createServer} from 'node:http';
import {createWriteStream,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {TickMonitor} from './tick-monitor.mjs';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
const token=process.env.OTCHARTS_API_KEY||'';
const list=(process.env.MSAI_SYMBOLS||'EURUSD_otc,GBPUSD_otc,USDJPY_otc,AUDUSD_otc,BTCUSD_otc').split(',').map(s=>s.trim()).filter(s=>/^[A-Za-z0-9#_]{2,60}$/.test(s));
if(!token){console.error('Missing OTCHARTS_API_KEY. Use start-windows.ps1 to enter it securely.');process.exit(2)}
if(!list.length||list.length>5){console.error('Select one to five Pocket Option OTC markets.');process.exit(2)}
const monitor=new TickMonitor(list);
const files=new Map();let stopped=false,latestError='',connection='disconnected';let count=0,lastAt=0,connections=0;
const dataDir=join(root,'data');mkdirSync(dataDir,{recursive:true});
function writer(symbol,time){const day=new Date(time*1000).toISOString().slice(0,10),key=`${symbol}-${day}`;
 if(!files.has(key))files.set(key,createWriteStream(join(dataDir,`${key}.ndjson`),{flags:'a'}));return files.get(key);}
function handleTick(ev){
 const symbol=String(ev.symbol||''),price=Number(ev.price),time=Number(ev.time);
 if(!list.includes(symbol)||!Number.isFinite(price)||price<=0||!Number.isFinite(time)||time<1e9||time>Date.now()/1000+300)return;
 const record={time,price,symbol,receivedAt:Date.now()};
 // Keep the raw tick even if it is a duplicate/out of order; quality report handles this.
 writer(symbol,time).write(JSON.stringify(record)+'\n');count++;lastAt=Date.now();monitor.observe(record);
 if(count%1000===0)console.log(`Saved ${count} ticks · Latest ${symbol} ${price} · candidate signals ${monitor.recentSignals().length}`);
}
function parseEvents(raw,onEvent){
 const lines=raw.split(/\r?\n/);let type='message',data=[];
 for(const line of lines){if(line.startsWith('event:'))type=line.slice(6).trim();else if(line.startsWith('data:'))data.push(line.slice(5).trim());}
 if(data.length)try{onEvent(type,JSON.parse(data.join('\n')))}catch{}
}
async function openStream(){
 const url=new URL('https://otcharts.com/v1/stream');url.searchParams.set('venue','otc');url.searchParams.set('symbol',list.join(','));
 const ac=new AbortController();let idle;
 const resetIdle=()=>{clearTimeout(idle);idle=setTimeout(()=>ac.abort('silent feed'),90000)};
 try{
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'text/event-stream','User-Agent':'MarketShakerAI-AttendedTickCollector/5'},signal:ac.signal});
  if(!response.ok){const body=(await response.text().catch(()=>'' )).slice(0,300);let error=`OTCharts HTTP ${response.status}: ${body}`;
   if([400,401,402,403,429].includes(response.status))error='STOP: '+error;throw new Error(error)}
  connection='connected';latestError='';connections++;console.log('OTCharts stream connected. Saving ticks for '+list.join(', '));resetIdle();
  const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
  while(!stopped){const {done,value}=await reader.read();if(done)break;resetIdle();pending+=decoder.decode(value,{stream:true});
   if(pending.length>1000000){pending='';throw new Error('Stream event buffer exceeded limit')}
   // SSE messages are separated by a blank line, regardless of LF/CRLF.
   pending=pending.replace(/\r\n/g,'\n');let end;while((end=pending.indexOf('\n\n'))!==-1){let packet=pending.slice(0,end);pending=pending.slice(end+2);
    parseEvents(packet,(kind,body)=>{
     if(kind==='connected')console.log('Subscribed: '+(body.symbols||[]).join(', '));
     else if(kind==='tick')handleTick(body);
     else if(kind==='closed')console.log('Market closed event '+JSON.stringify(body).slice(0,150));
     else if(kind==='error')latestError='Provider error: '+JSON.stringify(body).slice(0,250);
    });
   }
  }
 }finally{clearTimeout(idle);ac.abort();connection='disconnected'}
}
const PORT=4147;
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Market Shaker AI Live Tick Monitor</title><style>body{background:#07111d;color:#e9f4ff;font:15px system-ui;max-width:1000px;margin:25px auto;padding:15px}h1{color:#2ddabf}section{background:#122136;border:1px solid #345; padding:17px;border-radius:12px;margin:15px 0}table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #3a485c}small{color:#a9bad0}.tag{color:#36e0c1}</style><h1>Market Shaker AI · Live Tick Recorder</h1><p>Local Windows session only • No broker trades • Research scanner, not proven signals</p><section id="summary">Connecting to stream…</section><section><h3>Markets</h3><table><thead><tr><th>Asset</th><th>Last price</th><th>Tick count</th><th>Feed age</th></tr></thead><tbody id="markets"></tbody></table></section><section><h3>Recent pattern candidates (research-only)</h3><div id="candidates">Waiting for live ticks…</div><small>These are NOT validated CALL/PUT trade instructions; outcomes require later price evaluation and latency modeling.</small></section><script>async function refresh(){try{const r=await fetch('/state');const d=await r.json();document.querySelector('#summary').textContent='Stream: '+d.connection+' · ticks recorded: '+d.totalTicks+' · reconnects: '+d.connections+' · last error: '+(d.error||'none');document.querySelector('#markets').replaceChildren();for(let s of d.markets){const tr=document.createElement('tr');for(let v of [s.symbol,s.lastPrice??'—',s.count,(s.ageSeconds??'—')+'s']){const td=document.createElement('td');td.textContent=v;tr.append(td)}document.querySelector('#markets').append(tr)}document.querySelector('#candidates').textContent=(d.candidates||[]).slice(-8).reverse().map(x=>x.symbol+' · '+x.label+' · '+x.expiry+'s · '+x.direction+' · '+(x.reason||'')).join('\n')||'No current pattern candidates';document.querySelector('#candidates').style.whiteSpace='pre-line';}catch(e){document.querySelector('#summary').textContent='Local collector not responding: '+e.message}}refresh();setInterval(refresh,1500)</script>`;
const server=createServer((req,res)=>{
 if(req.url==='/state'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify({connection,totalTicks:count,connections,lastTickAt:lastAt,error:latestError,markets:monitor.summary(),candidates:monitor.recentSignals()}));}
 else if(req.url==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)}
 else{res.writeHead(404);res.end('Not found')}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Local monitor: http://127.0.0.1:${PORT}/\nPress Ctrl+C to stop collecting.`));
async function main(){let retry=0;
 while(!stopped){try{await openStream();retry=0;if(!stopped){latestError='Stream closed; reconnecting';console.log(latestError)}}catch(e){latestError=e.message;console.error(latestError);if(latestError.startsWith('STOP:'))break;}
  if(stopped)break;await sleep(Math.min(60000,1500*Math.pow(2,Math.min(retry++,6))))
 }
 shutdown();}
function shutdown(){if(stopped&&server.listening===false)return;stopped=true;connection='stopped';for(const f of files.values())f.end();server.close();console.log('Collector stopped. Tick files saved in collector/data.');}
process.on('SIGINT',()=>{shutdown();process.exit(0)});process.on('SIGTERM',()=>{shutdown();process.exit(0)});
main();
