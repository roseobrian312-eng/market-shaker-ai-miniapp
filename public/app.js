import {MARKETS} from './scanner.mjs';
import {analyzeSmart,backtest,EXPIRIES} from './strategies.mjs';
import {trainResearchModel} from './ml.mjs';
const $=id=>document.getElementById(id);
const telegram=window.Telegram?.WebApp;
if(telegram){try{telegram.ready();telegram.expand();telegram.setHeaderColor('#0a1428');telegram.setBackgroundColor('#070e1b');}catch{}}
const state={symbol:'EURUSD_otc',tf:30,expiry:30,strategy:'pullback',last:null,signal:null,history:loadHistory(),scanning:false,results:loadResults(),recordable:null};
let toastTimer;
function loadHistory(){try{const out=JSON.parse(localStorage.getItem('msai.history')||'[]');return Array.isArray(out)?out.slice(0,50):[]}catch{return []}}
function saveHistory(){try{localStorage.setItem('msai.history',JSON.stringify(state.history.slice(0,50)))}catch{}}
function loadResults(){try{const x=JSON.parse(localStorage.getItem('msai.userReports.v3')||'[]');return Array.isArray(x)?x.slice(0,1000):[]}catch{return []}}
function saveResults(){try{localStorage.setItem('msai.userReports.v3',JSON.stringify(state.results.slice(0,1000)))}catch{}}
function renderResultStats(){
 const wins=state.results.filter(x=>x.outcome==='win').length,losses=state.results.filter(x=>x.outcome==='loss').length;
 $('actualWins').textContent=String(wins);$('actualLosses').textContent=String(losses);
 $('actualRate').textContent=(wins+losses)?(100*wins/(wins+losses)).toFixed(1)+'%':'—';
 const available=!!state.recordable&&!state.results.some(x=>x.id===state.recordable.id);
 $('recordWin').disabled=!available;$('recordLoss').disabled=!available;
 $('resultHint').textContent=available?'After placing a manual trade, record its actual outcome here.': 'Records are user-reported; results are not verified by Pocket Option.';
}
function recordOutcome(outcome){
 if(!['win','loss'].includes(outcome)||!state.recordable){toast('Scan a fresh qualifying setup first');return}
 if(state.results.some(x=>x.id===state.recordable.id)){toast('This setup has already been recorded');return}
 state.results.unshift({...state.recordable,outcome,reportedAt:Date.now(),source:'user-reported'});
 saveResults();state.recordable=null;renderResultStats();toast(`Your ${outcome} was recorded, not independently verified`);
}
function exportResults(){
 const lines=['id,symbol,side,time_utc,outcome,source',...state.results.map(r=>[r.id,r.symbol,r.side,new Date(r.reportedAt).toISOString(),r.outcome,'user-reported'].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(','))];
 const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='market-shaker-user-reported-results.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

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
 $('signalTime').textContent=x?.lastBarTime?`Latest completed candle: ${displayTime(x.lastBarTime)} • ${state.tf} sec`:'No recent verified candle loaded';
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
function showTab(tab){document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('hidden',el.dataset.screen!==tab));document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.nav===tab));if(tab==='history')renderHistory();if(tab==='lab')renderLabDataset();if(tab==='scanner'&&state.signal?.candles)requestAnimationFrame(()=>renderChart(state.signal.candles));window.scrollTo({top:0,behavior:'instant'})}
function renderHistory(){const box=$('historyList');box.replaceChildren();if(!state.history.length){const p=document.createElement('p');p.className='muted';p.textContent='No saved CALL/PUT alerts yet. A result is logged only when the completed-candle scanner detects a setup.';box.append(p);return;}for(const item of state.history){const row=document.createElement('div');row.className='historyrow';const left=document.createElement('div');const market=document.createElement('b');market.textContent=labelMarket(item.symbol);const time=document.createElement('small');time.textContent=`${item.tf} sec • ${item.strategy||'legacy'} • ${displayTime(item.time)}`;left.append(market,time);const side=document.createElement('strong');side.textContent=item.side;side.className=item.side==='PUT'?'put':'';row.append(left,side);box.append(row)}}
function renderWatchlist(){const box=$('watchlist');box.replaceChildren();for(const item of MARKETS){const btn=document.createElement('button');btn.type='button';btn.className='watchrow';const left=document.createElement('div');const name=document.createElement('b');name.textContent=item.name;const desc=document.createElement('small');desc.textContent='Pocket Option • OTC data';left.append(name,desc);const right=document.createElement('span');right.textContent='›';btn.append(left,right);btn.addEventListener('click',()=>{state.symbol=item.symbol;$('market').value=item.symbol;resetSignal();showTab('scanner');toast(`Selected ${item.name}`)});box.append(btn)}}
function resetSignal(){state.recordable=null;renderResultStats();state.signal=null;state.last=null;renderSignal(null);renderChart(null);setStatus('Select Scan for new OTC candles, or use Saved Candles (0 API requests).');}
function datasetKey(){return `msai.dataset.${state.symbol}.${state.tf}`}
function saveDataset(data){try{
 const old=loadDataset();const pair=old?.data?.symbol===data.symbol&&old?.data?.tf===data.tf?old.data.candles:[];
 const merged=[...new Map([...pair,...data.candles].map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time).slice(-12000);
 localStorage.setItem(datasetKey(),JSON.stringify({time:Date.now(),data:{...data,candles:merged}}));
}catch{toast('Browser storage is full. Data may not have been saved.')}}
function loadDataset(){try{const object=JSON.parse(localStorage.getItem(datasetKey())||'null');return object?.data?.candles?.length?object:null}catch{return null}}
function expiryChoices(){const choices=$('expiry');[...choices.options].forEach(o=>{o.disabled=Number(o.value)%state.tf!==0||Number(o.value)<state.tf});if(Number(choices.value)%state.tf!==0||Number(choices.value)<state.tf)choices.value=state.tf===60?'60':state.tf===30?'30':'30';state.expiry=Number(choices.value)}
function processData(data,saved=false){
  if(data.source!=='OTCharts / Pocket Option OTC (independent feed)'||data.symbol!==state.symbol||data.tf!==state.tf)throw new Error('Wrong market or unexpected data source');
  const result=analyzeSmart(data.candles,state.tf,Math.floor(Date.now()/1000),{open:data.open},state.strategy);
  if(data.gaps?.runs>0){result.status='gap';result.side=null;result.reason='Provider reported missing candles; no real-time setup accepted'}
  if(state.expiry<30){result.side=null;result.status='lab-only';result.reason='Under 30-second expiries are research only until entry latency is measured'}
  state.last=data;state.signal=result;renderSignal(result);renderChart(result.candles||[]);
  if(['stale','error','gap','closed','waiting','lab-only'].includes(result.status))setStatus(`${saved?'Saved dataset':'Live feed'} • ${result.reason}`,result.status==='stale'?'waiting':'error');
  else setStatus(`${saved?'Cached candle set (not live)':'OTC data received'} • ${labelMarket(state.symbol)} • ${data.candles.length} bars`,'connected');
  state.recordable=null;
  if(!saved&&result.status==='watch'&&state.tf>=30){
    state.recordable={id:`${state.symbol}_${state.tf}_${state.strategy}_${result.lastBarTime}_${result.side}`,symbol:state.symbol,tf:state.tf,side:result.side,time:result.lastBarTime};
  }
  renderResultStats();
  if(!saved&&result.status==='watch'){const id=`${state.symbol}-${state.tf}-${state.strategy}-${result.lastBarTime}-${result.side}`;
    if(!state.history.some(item=>item.id===id)){state.history.unshift({id,side:result.side,symbol:state.symbol,tf:state.tf,strategy:state.strategy,time:result.lastBarTime});state.history=state.history.slice(0,50);saveHistory();}
    if(telegram?.HapticFeedback)telegram.HapticFeedback.notificationOccurred('success')}
}
function trainML(){
 const cached=loadDataset();if(!cached){toast('Load OTC candles once before training');return}
 const out=trainResearchModel(cached.data.candles,state.tf,Number($('labExpiry').value),Number($('labPayout').value));
 const parent=$('mlResults');parent.replaceChildren();const p=document.createElement('p');p.className='muted';
 if(out.error){p.textContent=out.error;parent.append(p);return}
 p.textContent=`Real logistic-regression model trained on ${out.trainCount} past examples, evaluated on ${out.holdoutCount} later unseen examples. Model decision threshold: ${(out.threshold*100).toFixed(1)}% (uncalibrated score).`;parent.append(p);
 const row=document.createElement('div');row.className='labstat';const title=document.createElement('b');title.textContent=out.winRate===null?'No ML test signals':`${out.winRate.toFixed(1)}% MODELED holdout win rate`;const info=document.createElement('small');info.textContent=`${out.wins}W / ${out.losses}L on ${out.holdoutSignals} hypothetical signals; skipped ${out.skipped}. Net ${out.netUnits>=0?'+':''}${out.netUnits.toFixed(2)} units at the selected payout.`;row.append(title,info);parent.append(row);
 const warning=document.createElement('p');warning.className='hint';warning.textContent='These are hypothetical results, not broker-verified trades. This model cannot issue live AI signals yet and needs independent forward testing.';parent.append(warning);
}
function renderLabDataset(){
  const cached=loadDataset();$('labDataset').textContent=cached?`${labelMarket(state.symbol)} • ${state.tf}-second candles • ${cached.data.candles.length} bars • downloaded ${new Date(cached.time).toLocaleString()} (saved locally on this device)`:`No saved candles for ${labelMarket(state.symbol)} at ${state.tf} seconds. Select Scanner and download once, then return here.`;
  [...$('labExpiry').options].forEach(o=>o.disabled=Number(o.value)%state.tf!==0||Number(o.value)<state.tf);
  if(Number($('labExpiry').value)%state.tf!==0||Number($('labExpiry').value)<state.tf)$('labExpiry').value=state.expiry;
}
function runLab(){
 const cached=loadDataset(); if(!cached){toast('Scan once to save real candles before testing');return}
 const payout=Number($('labPayout').value),exp=Number($('labExpiry').value);
 const results=['pullback','baseline'].map(id=>backtest(cached.data.candles,state.tf,exp,id,payout));
 $('labResults').replaceChildren();
 for(let j=0;j<results.length;j++){
  const r=results[j],card=document.createElement('div');card.className='labcard';
  const title=document.createElement('h3');title.textContent=j===0?'Trend + Pullback Confirmation':'Original EMA + RSI';card.append(title);
  const intro=document.createElement('p');intro.textContent=r.error||`${r.bars} completed candles • simulated next-candle entry • ${exp}s expiry`;card.append(intro);
  if(!r.error){const grid=document.createElement('div');grid.className='labgrid';
  for(const [label,stat] of [['Development 70%',r.development],['Holdout 30%',r.holdout]]){
    const box=document.createElement('div');box.className='labstat';const labelEl=document.createElement('small');labelEl.textContent=label;box.append(labelEl);
    const win=document.createElement('b');win.textContent=stat.winRate===null?'Insufficient':`${stat.winRate.toFixed(1)}%`;win.className=stat.winRate!==null&&stat.winRate>r.breakEven?'good':'bad';box.append(win);
    const desc=document.createElement('small');desc.textContent=`${stat.wins}W / ${stat.losses}L / ${stat.ties} ties • ${stat.signals} signals`;box.append(desc);
    const pnl=document.createElement('small');pnl.textContent=stat.netUnits===null?'No trade outcomes':`Net ${stat.netUnits>=0?'+':''}${stat.netUnits.toFixed(2)} units at ${payout}% payout`;box.append(pnl);grid.append(box);
  }card.append(grid);const note=document.createElement('p');note.textContent=`Break-even accuracy ${r.breakEven.toFixed(1)}%. Fewer than 100 holdout trades = insufficient evidence. Results exclude entry delay and cannot predict the next trade.`;card.append(note)}
  $('labResults').append(card)
 }
}

async function scan(){if(state.scanning)return;
 const code=$('accessCode').value.trim();if(!code){toast('Enter your private scanner access code first');return}
 state.scanning=true;const btn=$('scanBtn');btn.disabled=true;btn.textContent='DOWNLOADING MARKET DATA…';setStatus('Requesting one set of OTC candles (one API call)…');
 try{
  const response=await fetch(`/.netlify/functions/candles?symbol=${encodeURIComponent(state.symbol)}&tf=${state.tf}`,{cache:'no-store',headers:{'x-scanner-code':code}});
  const data=await response.json();if(!response.ok)throw new Error(data.error||`Data unavailable (${response.status})`);
  saveDataset(data);processData(data);toast(`${data.candles.length} new candles received; saved history now available in Strategy Lab`);
 }catch(err){state.recordable=null;renderResultStats();state.signal={status:'error',reason:err.message||'Market-data provider unavailable'};renderSignal(state.signal);renderChart(null);setStatus(state.signal.reason,'error');toast('Scan failed; no trading alert issued')}finally{state.scanning=false;btn.disabled=false;btn.innerHTML='<span>⌕</span> SCAN MARKET (1 API REQUEST)'}
}
MARKETS.forEach(m=>{const option=document.createElement('option');option.value=m.symbol;option.textContent=m.name;$('market').append(option)});
$('market').addEventListener('change',e=>{state.symbol=e.target.value;resetSignal()});
document.querySelectorAll('.tf').forEach(b=>b.addEventListener('click',()=>{state.tf=Number(b.dataset.tf);document.querySelectorAll('.tf').forEach(t=>t.classList.toggle('active',t===b));expiryChoices();resetSignal()}));
$('strategy').addEventListener('change',e=>{state.strategy=e.target.value;resetSignal()});
$('expiry').addEventListener('change',e=>{state.expiry=Number(e.target.value);resetSignal()});
$('savedBtn').addEventListener('click',()=>{const cached=loadDataset();if(!cached){toast('No candles saved for this asset and interval; scan once');return}try{processData(cached.data,true);toast('Reused saved dataset — 0 API requests')}catch(e){toast(e.message)}});
$('testBtn').addEventListener('click',runLab);$('trainML').addEventListener('click',trainML);
$('scanBtn').addEventListener('click',scan);document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.nav)));
$('clearHistory').addEventListener('click',()=>{state.history=[];saveHistory();renderHistory();toast('Saved local history cleared')});
$('recordWin').addEventListener('click',()=>recordOutcome('win'));$('recordLoss').addEventListener('click',()=>recordOutcome('loss'));$('downloadOutcomes').addEventListener('click',exportResults);$('clearOutcomes').addEventListener('click',()=>{if(!confirm('Delete the user-reported results on this device?'))return;state.results=[];state.recordable=null;saveResults();renderResultStats();toast('Local user-reported results cleared')});
$('timeNow').textContent=new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
renderWatchlist();renderHistory();renderResultStats();renderSignal(null);renderChart(null);expiryChoices();setStatus('Ready for owner-authorized OTC data research. Enter your access code, then Scan once.');
