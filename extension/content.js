(() => {
 'use strict';
 if (document.getElementById('msai-extension-host')) return;
 const host=document.createElement('div');host.id='msai-extension-host';
 host.style.cssText='all:initial;position:fixed;top:100px;right:18px;z-index:2147483646;pointer-events:none';
 const root=host.attachShadow({mode:'closed'});
 root.innerHTML=`
 <style>
 :host{all:initial}*{box-sizing:border-box}button,select{font:inherit}
 .panel{pointer-events:auto;font:13px/1.35 system-ui,-apple-system,sans-serif;color:#eff8fc;width:308px;border-radius:15px;background:#0b192d;box-shadow:0 14px 60px #0008;border:1px solid #496077;overflow:hidden}
 .titlebar{padding:12px;background:#14283e;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:move;touch-action:none;user-select:none}
 .brand{font-weight:900;letter-spacing:.08em;font-size:12px}.brand em{font-style:normal;color:#35e4bb}.controls{display:flex;gap:4px}
 button{border:0;border-radius:8px;padding:8px;background:#263b52;color:#eff8fc;cursor:pointer}button:hover{filter:brightness(1.15)}button:disabled{opacity:.5;cursor:not-allowed}
 .controls button{padding:4px 9px;font-size:13px}.body{padding:13px}.tag{font-size:10px;letter-spacing:.09em;font-weight:700;color:#94aeca}
 .signal{text-align:center;margin:12px 0 6px;font-size:24px;font-weight:900;letter-spacing:.05em}.call{color:#34deb5}.put{color:#fc849b}.quiet{color:#afbed1}
 .reason{font-size:12px;color:#a5b9cc;min-height:36px;text-align:center;overflow-wrap:anywhere}
 .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:12px 0}.stat{background:#14263d;border-radius:9px;padding:10px 5px;text-align:center}
 .stat small{font-size:10px;color:#91a9c1;display:block}.stat strong{font-size:20px;display:block;margin-top:4px}
 .fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field label{font-size:10px;color:#adc1d1;display:block;margin-bottom:5px}.field select{width:100%;color:#f5faff;background:#1c3048;border:1px solid #344d67;border-radius:7px;padding:7px 3px;outline:none}
 .actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.scan{background:#35d8b3;color:#042b29;font-weight:800}.saved{background:#29445c}
 .result-buttons{display:flex;gap:7px;margin-top:8px}.result-buttons button{flex:1;background:#263d54}.result-buttons .win{color:#38e8c0}.result-buttons .loss{color:#ff99a9}
 .foot{font-size:10px;color:#9aafbf;margin-top:10px;border-top:1px solid #314357;padding-top:9px}.state{font-size:11px;color:#bbcad9;margin:10px 0 0;min-height:15px;overflow-wrap:anywhere}
 .launcher{pointer-events:auto;border-radius:999px;background:#112f38;border:1px solid #3cdbbe;color:#dbfff5;font:800 12px system-ui;padding:12px 15px;box-shadow:0 5px 20px #0008;cursor:pointer}
 .hidden{display:none!important}.time{font-size:10px;color:#97acc0;margin:7px 0;text-align:center}
 .link{margin-top:5px;color:#82f0da;font-size:11px;display:block;text-align:center}
 </style>
 <button id="launcher" class="launcher hidden" type="button">✦ MS AI</button>
 <div class="panel" id="panel">
 <div class="titlebar" id="drag"><span class="brand">✦ MARKET SHAKER <em>AI</em></span><span class="controls"><button id="settings" title="Open extension settings">⚙</button><button id="hide" title="Minimize overlay">—</button></span></div>
 <div class="body">
  <div class="tag">OTC SIGNAL ASSISTANT · NO AUTO-TRADING</div>
  <div class="stats"><div class="stat"><small>Recorded wins</small><strong id="wins">0</strong></div><div class="stat"><small>Recorded losses</small><strong id="losses">0</strong></div><div class="stat"><small>Recorded win rate</small><strong id="rate">—</strong></div></div>
  <div class="fields"><div class="field"><label>MARKET</label><select id="symbol"><option value="EURUSD_otc">EUR/USD OTC</option><option value="GBPUSD_otc">GBP/USD OTC</option><option value="USDJPY_otc">USD/JPY OTC</option><option value="AUDUSD_otc">AUD/USD OTC</option><option value="BTCUSD_otc">BTC/USD OTC</option></select></div>
   <div class="field"><label>CANDLE SIZE</label><select id="tf"><option value="30">30 seconds</option><option value="60">60 seconds</option><option value="15">15s (research)</option><option value="5">5s (research)</option></select></div></div>
  <div class="signal quiet" id="side">NO SIGNAL</div><div class="reason" id="reason">Press Scan once to request real candles.</div><div class="time" id="checked">Data not loaded</div>
  <div class="actions"><button class="scan" id="scan" type="button">SCAN · 1 REQUEST</button><button class="saved" id="cached" type="button">SAVED · 0</button></div>
  <div class="result-buttons"><button id="win" class="win" disabled>✓ I WON</button><button id="loss" class="loss" disabled>✕ I LOST</button></div>
  <p class="state" role="status" id="status">Ready. Use Chrome extension settings for your private scanner code.</p>
  <div class="foot">W/L = outcomes you report manually, not broker-verified or backtested wins. Signals are rule-based research, not AI-model predictions. One scan may consume one OTCharts credit; never scans automatically.</div>
  <a class="link" href="https://market-shaker-ai-miniapp.netlify.app/" target="_blank" rel="noopener noreferrer">Open Telegram-compatible dashboard ↗</a>
 </div></div>`;
 (document.documentElement||document.body).append(host);
 const $=id=>root.getElementById(id);
 let active=null,busy=false;
 const fmtTime=t=>t?new Date(t*1000).toLocaleTimeString():'—';
 function message(msg){$('status').textContent=msg;}
 function setStats(stats){$('wins').textContent=String(stats.wins);$('losses').textContent=String(stats.losses);$('rate').textContent=stats.winRate===null?'—':`${stats.winRate.toFixed(1)}%`;}
 async function send(payload){return new Promise((resolve,reject)=>{
   try{chrome.runtime.sendMessage(payload,response=>{
     if(chrome.runtime.lastError)return reject(Error(chrome.runtime.lastError.message));
     if(!response?.ok)return reject(Error(response?.error||'Extension service unavailable'));
     resolve(response);
   });}catch(e){reject(e);}
 });}
 function disableResult(){active=null;$('win').disabled=true;$('loss').disabled=true;}
 function display(s){
   disableResult();$('side').className='signal quiet';$('side').textContent=s.status==='watch'?s.side:'NO SIGNAL';
   if(s.status==='watch')$('side').className=`signal ${s.side==='CALL'?'call':'put'}`;
   $('reason').textContent=s.reason||'No qualifying entry';
   $('checked').textContent=`${s.saved?'Saved bars (not live)':'Latest data'} · ${s.candleTime?fmtTime(s.candleTime):'unavailable'}`;
   if(s.status==='watch'&&!s.saved&&s.candleTime){
     const id=`${s.symbol}_${s.tf}_${s.strategy}_${s.candleTime}_${s.side}`;
     active={id,side:s.side,symbol:s.symbol};
     $('win').disabled=false;$('loss').disabled=false;
   }
 }
 async function scan(cached){
   if(busy)return;busy=true;$('scan').disabled=true;$('cached').disabled=true;disableResult();
   message(cached?'Recalculating with saved candles (no API call)…':'Downloading candles; one API request…');
   try{const r=await send({type:'MSAI_SCAN',symbol:$('symbol').value,tf:Number($('tf').value),strategy:'pullback',cached});display(r.signal);message(`${r.signal.status.toUpperCase()} · ${r.signal.barCount} candles · ${cached?'0':'1'} provider request${cached?'':' (normally)'}`);}
   catch(e){$('side').textContent='NO SIGNAL';$('reason').textContent='Scan unavailable';$('checked').textContent='Data not verified';message(e.message);}
   finally{busy=false;$('scan').disabled=false;$('cached').disabled=false;}
 }
 async function report(outcome){
   if(!active)return;const selected=active;
   try{const r=await send({type:'MSAI_REPORT',id:selected.id,symbol:selected.symbol,side:selected.side,outcome});setStats(r.stats);disableResult();message(`Recorded your reported ${outcome}. This is not broker verification.`);}
   catch(e){message(e.message);if(e.message.includes('already recorded'))disableResult();}
 }
 $('scan').addEventListener('click',()=>scan(false));$('cached').addEventListener('click',()=>scan(true));
 $('win').addEventListener('click',()=>report('win'));$('loss').addEventListener('click',()=>report('loss'));
 $('symbol').addEventListener('change',disableResult);$('tf').addEventListener('change',disableResult);
 $('settings').addEventListener('click',()=>chrome.runtime.sendMessage({type:'MSAI_OPEN_SETTINGS'}));
 $('hide').addEventListener('click',()=>{$('panel').classList.add('hidden');$('launcher').classList.remove('hidden');});
 $('launcher').addEventListener('click',()=>{$('panel').classList.remove('hidden');$('launcher').classList.add('hidden');});
 // Drag only from titlebar. No DOM inspection, clicks, or trading-site automation.
 let drag=null;
 $('drag').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const b=host.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:b.left,top:b.top};$('drag').setPointerCapture(e.pointerId);});
 $('drag').addEventListener('pointermove',e=>{if(!drag)return;const left=Math.max(0,Math.min(innerWidth-80,drag.left+e.clientX-drag.x));const top=Math.max(0,Math.min(innerHeight-35,drag.top+e.clientY-drag.y));host.style.left=`${left}px`;host.style.top=`${top}px`;host.style.right='auto';});
 $('drag').addEventListener('pointerup',()=>{drag=null;});$('drag').addEventListener('pointercancel',()=>{drag=null;});
 send({type:'MSAI_GET_STATS'}).then(r=>setStats(r.stats)).catch(e=>message(e.message));
})();
