/** Secret-only server proxy. OTCharts API key never reaches the user's web browser. */
const ALLOWED = new Set(['EURUSD_otc','GBPUSD_otc','USDJPY_otc','AUDUSD_otc','BTCUSD_otc']);
const validTF = new Set(['5','15','30','60']);
const respond=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
export default async function handler(request) {
  if(request.method!=='GET') return respond({error:'GET only'},405);
  const url=new URL(request.url);
  const symbol=url.searchParams.get('symbol')||'EURUSD_otc';
  const tf=url.searchParams.get('tf')||'60';
  const limit=Math.max(1,Math.min(5000,Number.parseInt(url.searchParams.get('limit')||'500',10)||500));
  // Full history pagination (before=) is paid Build+ only. Do not poll candle endpoint continuously.
  const before=url.searchParams.get('before');
  if(before!==null && !/^[0-9]{9,12}$/.test(before))return respond({error:'Invalid historical cursor'},400);
  if(!ALLOWED.has(symbol)||!validTF.has(tf)) return respond({error:'Unsupported market or timeframe'},400);
  const access=(process.env.SCANNER_ACCESS_CODE||'').trim();
  if(!access) return respond({error:'Owner access is not configured. Add SCANNER_ACCESS_CODE to Netlify environment variables.'},503);
  if((request.headers.get('x-scanner-code')||'').trim()!==access) return respond({error:'Owner access code is missing or incorrect.'},401);
  const key=process.env.OTCHARTS_API_KEY;
  if(!key) return respond({error:'Data provider not configured. Add OTCHARTS_API_KEY in Netlify environment variables.'},503);
  if(url.searchParams.get('verify')==='1') return respond({ok:true,verified:true,message:'Scanner password verified. No OTCharts API request made.'});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const api=new URL('https://otcharts.com/v1/candles');
    api.searchParams.set('venue','otc');api.searchParams.set('symbol',symbol);api.searchParams.set('tf',tf);api.searchParams.set('limit',String(limit));if(before)api.searchParams.set('before',before);
    const remote=await fetch(api,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},signal:controller.signal});
    const body=await remote.json().catch(()=>({}));
    if(!remote.ok) return respond({error:remote.status===429?'Market data quota or rate limit reached':(body.error||body.detail||`Market-data provider error ${remote.status}`)},remote.status===429?429:502);
    if(!Array.isArray(body.candles)) return respond({error:'Unexpected market-data response'},502);
    // The provider documents Pocket Option timestamps as broker time UTC+2.
    const candles=body.candles.map(x=>({open:Number(x.open),high:Number(x.high),low:Number(x.low),close:Number(x.close),time:Number(x.time)-7200}));
    return respond({source:'OTCharts / Pocket Option OTC (independent feed)',symbol,tf:Number(tf),candles,open:body.open!==false,gaps:body.gaps||null,fetchedAt:Math.floor(Date.now()/1000),timestampNote:'OTCharts Pocket Option venue timestamps normalized by -7200 seconds.'});
  } catch(err) {return respond({error:err.name==='AbortError'?'Market feed timed out':'Could not contact market-data provider'},502);} finally{clearTimeout(timeout);}
}
