/** Local preview, not required for Telegram deployment. */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  if(req.url.startsWith('/.netlify/functions/candles')) {res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'Local preview: market data needs Netlify deployment and OTCHARTS_API_KEY.'}));return;}
  const name=(req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0].slice(1));
  if(!['index.html','styles.css','app.js','scanner.mjs'].includes(name)){res.writeHead(404);res.end('Not found');return;}
  try {const data=await readFile(new URL(`./public/${name}`,import.meta.url));res.writeHead(200,{'content-type':types[name.slice(name.lastIndexOf('.'))]});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
}).listen(3000,()=>console.log('Preview at http://localhost:3000 (live feed requires Netlify)'));
