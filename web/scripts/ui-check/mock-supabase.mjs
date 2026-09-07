// Local-only PostgREST/Storage stand-in. State lives in memory; no production credentials.
import http from 'node:http';
import sharp from 'sharp';
import fixtures from './fixtures.mjs';
const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 55321);
const tables = structuredClone(fixtures);
const objects = new Map();
const missing = new Set();
const placeholder = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#263647"/><text x="320" y="240" fill="#aac3d1" text-anchor="middle" font-size="28">batch photo</text></svg>`)).png().toBuffer();
function matches(row, key, expression) {
  if (key === 'or') return expression.slice(1,-1).split(/,(?![^()]*\))/).some((clause) => { const i=clause.indexOf('.'); return matches(row,clause.slice(0,i),clause.slice(i+1)); });
  let [op,...rest] = expression.split('.'); let value = rest.join('.'); const actual = row[key];
  if(op === 'not') return !matches(row,key,value);
  if(op === 'is') return value === 'null' ? actual == null : String(actual) === value;
  if(op === 'in') return value.slice(1,-1).split(',').includes(String(actual));
  if(op === 'eq') return String(actual) === value;
  if(op === 'neq') return String(actual) !== value;
  if(op === 'lte') return actual <= value;
  if(op === 'gte') return actual >= value;
  return true;
}
const server = http.createServer(async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS');
  if(req.method==='OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url,`http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const chunks=[]; for await(const chunk of req) chunks.push(chunk); const raw=Buffer.concat(chunks);
  let body={}; try { body=JSON.parse(raw.toString() || '{}'); } catch { /* raw storage upload */ }
  function json(value,status=200) { res.writeHead(status,{'content-type':'application/json'}); res.end(JSON.stringify(value)); }
  if(path.startsWith('/storage/v1/bucket')) return json({ id:'batch-media',name:'batch-media',public:false });
  if(path.startsWith('/storage/v1/object/upload/sign/')) {
    const key=path.split('/object/upload/sign/')[1];
    if(req.method==='POST') return json({ url:`/object/upload/sign/${key}?token=mock`,token:'mock' });
    objects.set(key,{raw,type:req.headers['content-type']}); return json({Key:key});
  }
  if(path.startsWith('/storage/v1/object/info/')) { const object=objects.get(path.split('/object/info/')[1]); return object ? json({size:object.raw.length}) : json({message:'not found'},404); }
  if(path.startsWith('/storage/v1/object/sign/')) {
    const key=path.split('/object/sign/')[1];
    if(req.method==='POST') return json(body.paths ? body.paths.map(p=>({path:p,signedURL:`/object/sign/${key}/${p}?token=mock`})) : { signedURL:`/object/sign/${key}?token=mock` });
    const object=objects.get(key); res.writeHead(200,{'content-type':object?.type || 'image/png'}); return res.end(object?.raw || placeholder);
  }
  if(path.startsWith('/storage/v1/object/')) {
    const key=path.split('/object/')[1]; const object=objects.get(key);
    if(req.method==='GET') { if(!object) return json({message:'not found'},404); res.writeHead(200,{'content-type':object.type}); return res.end(object.raw); }
    if(req.method==='DELETE') { for(const name of body.prefixes || []) objects.delete(`batch-media/${name}`); return json([]); }
    objects.set(key,{raw,type:req.headers['content-type']}); return json({Key:key});
  }
  if(path==='/rest/v1/rpc/import_workbook') {
    const counts=Object.fromEntries(Object.entries(body.p_tables).map(([key,rows])=>[key,rows.length]));
    tables.sheet_imports.unshift({id:Date.now(),source:body.p_source,status:'ok',rows_upserted:counts,started_at:new Date().toISOString(),finished_at:new Date().toISOString()});
    return json(counts);
  }
  if(path==='/rest/v1/rpc/save_batch_media') {
    const row={...body.p_media,id:Date.now(),created_at:new Date().toISOString()};
    if(row.is_cover) for(const photo of tables.batch_media) if(photo.batch_id===row.batch_id) photo.is_cover=false;
    tables.batch_media.push(row); return json(row.id);
  }
  if(path.startsWith('/rest/v1/rpc/')) return json([]);
  const match=path.match(/^\/rest\/v1\/([a-zA-Z0-9_]+)$/);
  if(!match) return json({});
  const table=match[1];
  if(!tables[table]) { tables[table]=[]; if(!missing.has(table)) { missing.add(table); console.log(`[mock-supabase] no fixture for ${table}`); } }
  let rows=tables[table].filter(row=>[...url.searchParams].every(([key,value])=>['select','order','limit','offset','on_conflict'].includes(key) || matches(row,key,value)));
  if(req.method==='POST') {
    const input=Array.isArray(body)?body:[body]; rows=input.map(row=>({...row,id:row.id || Date.now()+Math.random(),created_at:new Date().toISOString()})); tables[table].push(...rows);
  } else if(req.method==='PATCH') { for(const row of rows) Object.assign(row,body); }
  else if(req.method==='DELETE') { tables[table]=tables[table].filter(row=>!rows.includes(row)); }
  const order=url.searchParams.get('order'); if(order) { const [key,direction]=order.split(/[,.]/); rows.sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''))*(direction==='desc'?-1:1)); }
  const total=rows.length; const limit=Number(url.searchParams.get('limit')); if(limit>0) rows=rows.slice(0,limit);
  res.setHeader('Content-Range',total?`0-${rows.length-1}/${total}`:'*/0');
  if(req.method==='HEAD') { res.writeHead(200); return res.end(); }
  const object=(req.headers.accept || '').includes('vnd.pgrst.object');
  if(object && !rows.length) return json({code:'PGRST116',details:'The result contains 0 rows',message:'Cannot coerce result to a single JSON object'},406);
  return json(object?rows[0]:rows);
});
server.listen(PORT,'127.0.0.1',()=>console.log(`[mock-supabase] listening on http://127.0.0.1:${PORT}`));
