import {MARKETS,analyzeCandles} from './scanner.mjs';
const $=id=>document.getElementById(id);
const telegram=window.Telegram?.WebApp;
if(telegram){try{telegram.ready();telegram.expand();telegram.setHeaderColor('#0a1428');telegram.setBackgroundColor('#070e1b');}catch{}}
const state={symbol:'EURUSD_otc',tf:60,last:null,signal:null,history:loadHistory(),scanning:false};
let toastTimer;
function loadHistory(){try{const out=JSON.parse(localStorage.getItem('msai.history')||'[]');return Array.isArray(out)?out.slice(0,50):[]}catch{return []}}
function saveHistory(){try{localStorage.setItem('msai.history',JSON.stringify(state.history.slice(0,50)))}catch{}}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000)}
function setStatus(message,kind='waiting'){$('dataStatus').textContent=message;$('safetyBar').className=`safety ${kind==='connected'?'connected':kind==='error'?'problem':''}`;$('connectionDot').className=`dot ${kind==='connected'?'ok':''}`;$('connectionName').textContent=kind==='connected'?'OTC DATA':'Not connected';}
function labelMarket(symbol){return MARKETS.find(m=>m.symbol===symbol)?.name||symbol}
function displayTime(timestamp){return new Date(timestamp*1000).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function priceNum(n){return Number(n).toLocaleString(undefined,{minimumFractionDigits:Number(n)>100?2:5,maximumFractionDigits:Number(n)>100?2:5})}
function renderSignal(x){
 const card=$('signalCard'); card.className='signalcard';
 const side=x?.side,signal=x?.status==='watch';if(signal)card.classList.add(side==='CALL'?'call':'put');
 $('signalMain').textContent=signal?`${side} ${side==='CALL'?'↗':'↘'}`:'NO SIGNAL';
 $('signalIcon').textContent=signal?(side==='CALL'?'↗':'↘'):'◎';
 $('signalState').textContent=x?.status==='watch'?'SETUP DETECTED':(x?.status?.toUpperCase()||'AWAITING DATA');
 $('signalReason').textContent=x?.reason||'Refresh to check a completed candle after connecting OTC data.';
 $('lastPrice').textContent=Number.isFinite(x?.lastClose)?priceNum(x.lastClose):'—';
 $('rsi').textContent=Number.isFinite(x?.rsi)?x.rsi.toFixed(1):'—';
 $('trend').textContent=x?.trend||'—';
 $('signalTime').textContent=x?.lastBarTime?`Latest completed candle: ${displayTime(x.lastBarTime)} • ${state.tf/60} min`:'No recent verified candle loaded';
 $('factors').replaceChildren();
 if(x?.factors?.length){const fields=['Trend relationship','Relative Strength Index','Candle direction'];x.factors.forEach((v,i)=>{const div=document.createElement('div');div.className='insight-line';const left=document.createElement('span'),right=document.createElement('span');left.textContent=fields[i]||'Indicator';right.textContent=v;div.append(left,right);$('factors').append(div)})}
 else {const p=document.createElement('p');p.className='muted';p.textContent=x?.reason||'Signal checks appear after a successful scan.';$('factors').append(p)}
}
function renderChart(candles){const canvas=$('chart'),ctx=canvas.getContext('2d');const density=window.devicePixelRatio||1;const bounds=canvas.getBoundingClientRect();const w=Math.max(280,bounds.width||400),h=Math.max(150,bounds.height||170);canvas.width=Math.round(w*density);canvas.height=Math.round(h*density);ctx.setTransform(density,0,0,density,0,0);ctx.clearRect(0,0,w,h);
 if(!candles?.length){canvas.dataset.filled='false';return}canvas.dataset.filled='true';
 const list=candles.slice(-40);const highs=list.map(c=>c.high),lows=list.map(c=>c.low);let min=Math.min(...lows),max=Math.max(...highs);let space=(max-min)*.13||Math.abs(max)*.001||.01;min-=space;max+=space;
 const pad={t:13,r:60,b:15,l:4},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b,step=cw/list.length;
 const y=p=>pad.t+(max-p)/(max-min)*ch;
 ctx.strokeStyle='#304059';ctx.lineWidth=1;ctx.font='10px system-ui';ctx.fillStyle='#8da0b9';
 for(let i=0;i<4;i++){const yy=pad.t+i*ch/3;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r+8,yy);ctx.stroke();const val=max-(max-min)*i/3;ctx.fillText(val.toFixed(val>100?2:5),w-pad.r+11,yy+3)}
 const bw=Math.max(3,Math.min(11,step*.56));list.forEach((c,i)=>{const x=pad.l+step*(i+.5),up=c.close>=c.open;ctx.strokeStyle=up?'#27dfbc':'#f37591';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y(c.high));ctx.lineTo(x,y(c.low));ctx.stroke();const a=y(c.open),b=y(c.close);ctx.fillRect(x-bw/2,Math.min(a,b),bw,Math.max(1,Math.abs(b-a)))});
}
function showTab(tab){document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('hidden',el.dataset.screen!==tab));document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.nav===tab));if(tab==='history')renderHistory();if(tab==='scanner'&&state.signal?.candles)requestAnimationFrame(()=>renderChart(state.signal.candles));window.scrollTo({top:0,behavior:'instant'})}
function renderHistory(){const box=$('historyList');box.replaceChildren();if(!state.history.length){const p=document.createElement('p');p.className='muted';p.textContent='No saved CALL/PUT alerts yet. A result is logged only when the completed-candle scanner detects a setup.';box.append(p);return;}for(const item of state.history){const row=document.createElement('div');row.className='historyrow';const left=document.createElement('div');const market=document.createElement('b');market.textContent=labelMarket(item.symbol);const time=document.createElement('small');time.textContent=`${item.tf/60} min • ${displayTime(item.time)}`;left.append(market,time);const side=document.createElement('strong');side.textContent=item.side;side.className=item.side==='PUT'?'put':'';row.append(left,side);box.append(row)}}
function renderWatchlist(){const box=$('watchlist');box.replaceChildren();for(const item of MARKETS){const btn=document.createElement('button');btn.type='button';btn.className='watchrow';const left=document.createElement('div');const name=document.createElement('b');name.textContent=item.name;const desc=document.createElement('small');desc.textContent='Pocket Option • OTC data';left.append(name,desc);const right=document.createElement('span');right.textContent='›';btn.append(left,right);btn.addEventListener('click',()=>{state.symbol=item.symbol;$('market').value=item.symbol;resetSignal();showTab('scanner');toast(`Selected ${item.name}`)});box.append(btn)}}
function resetSignal(){state.signal=null;state.last=null;renderSignal(null);renderChart(null);setStatus('Press Scan to check OTC prices. No automatic refresh.');}
async function scan(){if(state.scanning)return;state.scanning=true;const btn=$('scanBtn');btn.disabled=true;btn.textContent='SCANNING OTC MARKET…';setStatus('Requesting recent OTC candles…');
 try {const response=await fetch(`/.netlify/functions/candles?symbol=${encodeURIComponent(state.symbol)}&tf=${state.tf}`,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||`Data unavailable (${response.status})`);
  if(data.source!== 'OTCharts / Pocket Option OTC (independent feed)' || data.symbol!==state.symbol)throw new Error('Unexpected source or instrument');
  if(data.gaps?.runs>0){state.signal={status:'gap',reason:'Market-data provider reported missing candles. Skipping this scan.'};renderSignal(state.signal);setStatus('Market feed has gaps. No entry signal.','error');renderChart(null);return}
  const result=analyzeCandles(data.candles,state.tf,Math.floor(Date.now()/1000),{open:data.open});state.last=data;state.signal=result;renderSignal(result);renderChart(result.candles||[]);
  if(['stale','error','gap','closed','waiting'].includes(result.status))setStatus(result.reason,'error');else setStatus(`OTC candles received • ${labelMarket(state.symbol)} • checked ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`,'connected');
  if(result.status==='watch') {const id=`${state.symbol}-${state.tf}-${result.lastBarTime}-${result.side}`;if(!state.history.some(item=>item.id===id)){state.history.unshift({id,side:result.side,symbol:state.symbol,tf:state.tf,time:result.lastBarTime});state.history=state.history.slice(0,50);saveHistory()}if(telegram?.HapticFeedback)telegram.HapticFeedback.notificationOccurred('success');}
 }catch(err){state.signal={status:'error',reason:err.message||'Could not reach the data provider'};renderSignal(state.signal);renderChart(null);setStatus(err.message||'Data unavailable','error');toast('No market data: check the connection and server setup.')}finally{state.scanning=false;btn.disabled=false;btn.innerHTML='<span>⌕</span> SCAN SELECTED OTC MARKET'}}
MARKETS.forEach(m=>{const option=document.createElement('option');option.value=m.symbol;option.textContent=m.name;$('market').append(option)});
$('market').addEventListener('change',e=>{state.symbol=e.target.value;resetSignal()});
document.querySelectorAll('.tf').forEach(b=>b.addEventListener('click',()=>{state.tf=Number(b.dataset.tf);document.querySelectorAll('.tf').forEach(t=>t.classList.toggle('active',t===b));resetSignal()}));
$('scanBtn').addEventListener('click',scan);document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.nav)));
$('clearHistory').addEventListener('click',()=>{state.history=[];saveHistory();renderHistory();toast('Saved local history cleared')});
$('timeNow').textContent=new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
renderWatchlist();renderHistory();renderSignal(null);renderChart(null);setStatus('Live OTC market data is not connected until the API key is configured.');
