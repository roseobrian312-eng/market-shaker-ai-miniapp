/** Read-only closed-candle analysis. No brokerage orders, no invented accuracy. */
export const MARKETS = [
  {symbol:'EURUSD_otc', name:'EUR/USD OTC', short:'EUR/USD'},
  {symbol:'GBPUSD_otc', name:'GBP/USD OTC', short:'GBP/USD'},
  {symbol:'USDJPY_otc', name:'USD/JPY OTC', short:'USD/JPY'},
  {symbol:'AUDUSD_otc', name:'AUD/USD OTC', short:'AUD/USD'},
  {symbol:'BTCUSD_otc', name:'BTC/USD OTC', short:'BTC/USD'},
];
export const TF_OPTIONS = [60,300];
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function ema(values, period) {
  if (!Array.isArray(values) || values.length < period || values.some(v=>!finite(v))) return NaN;
  const k = 2/(period+1), seed = values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  return values.slice(period).reduce((out,val)=> val*k+out*(1-k), seed);
}
export function rsi(values, period=14) {
  if (!Array.isArray(values) || values.length <= period || values.some(v=>!finite(v))) return NaN;
  let gain=0, loss=0;
  for(let i=1;i<=period;i++){const diff=values[i]-values[i-1];gain+=Math.max(0,diff);loss+=Math.max(0,-diff);}
  gain/=period; loss/=period;
  for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];gain=(gain*(period-1)+Math.max(0,d))/period;loss=(loss*(period-1)+Math.max(0,-d))/period;}
  if (gain===0 && loss===0) return 50;
  if (loss===0) return 100;
  return 100-100/(1+gain/loss);
}
function result(status, reason, extras={}) {return { status, reason, side:null, ...extras };}
export function analyzeCandles(raw, tf=60, now=Math.floor(Date.now()/1000), meta={}) {
  if(!TF_OPTIONS.includes(tf)) return result('error','Unsupported timeframe');
  if(!Array.isArray(raw) || raw.length<35) return result('error','At least 35 candles are needed');
  if (meta.open===false) return result('closed','Market reported closed');
  const candles=raw.map(c=>({open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close),time:Number(c.time)})).sort((a,b)=>a.time-b.time);
  if(candles.some(c=>![c.open,c.high,c.low,c.close,c.time].every(finite)|| c.low>c.high || c.time<=0)) return result('error','Invalid candle data');
  const uniq=[];
  for(const c of candles) if(!uniq.length||c.time!==uniq[uniq.length-1].time) uniq.push(c);
  // A bar marked with its opening timestamp is only evaluated after its entire interval ends.
  const closed=uniq.filter(c=>c.time+tf<=now-2);
  if(closed.length<35) return result('waiting','Waiting for closed candles');
  const c=closed[closed.length-1],prev=closed[closed.length-2];
  if(now-(c.time+tf)>tf*2+20) return result('stale','Market data is too old', {lastBarTime:c.time});
  // Avoid false crossover signals produced across gaps in the venue's market data.
  const last35=closed.slice(-35);
  if(last35.some((bar,i)=> i && bar.time-last35[i-1].time!==tf)) return result('gap','Market data contains missing candles',{lastBarTime:c.time});
  const closes=closed.map(b=>b.close), fast=ema(closes,9), slow=ema(closes,21), strength=rsi(closes,14);
  const body=Math.abs(c.close-c.open), range=Math.max(1e-9,c.high-c.low);
  const momentumUp=c.close>prev.close, momentumDown=c.close<prev.close;
  const up=fast>slow && strength>=51 && strength<=72 && momentumUp && c.close>=c.open && body/range>=.20;
  const down=fast<slow && strength<=49 && strength>=28 && momentumDown && c.close<=c.open && body/range>=.20;
  const side=up?'CALL':down?'PUT':null;
  const trend=fast>slow?'Bullish':fast<slow?'Bearish':'Flat';
  const factors=[`EMA 9 / EMA 21: ${trend}`,`RSI (14): ${strength.toFixed(1)}`,`Last candle: ${c.close>c.open?'Up':c.close<c.open?'Down':'Flat'}`];
  return {status:side?'watch':'neutral',side,reason:side?'Conditions aligned on last closed candle':'No valid setup on last closed candle',lastBarTime:c.time,lastClose:c.close,ema9:fast,ema21:slow,rsi:strength,trend,factors,candles:closed.slice(-60),tf, checkedAt:now};
}
