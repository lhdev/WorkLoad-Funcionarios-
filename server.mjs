import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {validate} from './dist/domain.js';
import {seed} from './dist/seed.js';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const data=process.env.WORKLOAD_DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url));
mkdirSync(data,{recursive:true});
const db=new DatabaseSync(resolve(data,'workload.sqlite'));
db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, state TEXT NOT NULL)');
if(!db.prepare('SELECT id FROM workspace WHERE id=1').get())db.prepare('INSERT INTO workspace VALUES(1,0,?)').run(JSON.stringify(validate(seed())));
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host))return json(403,{error:'Host não autorizado.'});
const path=new URL(req.url,'http://localhost').pathname;
if(path==='/runtime.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end("globalThis.WORKLOAD_MODE = 'server';")}
if(path==='/api/state'){
 if(req.method==='GET'){const row=db.prepare('SELECT revision,state FROM workspace WHERE id=1').get();return json(200,{revision:row.revision,state:JSON.parse(row.state)})}
 if(req.method!=='PUT')return json(405,{error:'Método não permitido.'});
 if(req.headers.origin&&!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(req.headers.origin))return json(403,{error:'Origem não autorizada.'});
 if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'Use JSON.'});
 try{let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024){json(413,{error:'Base deve ter até 5 MB.'});return}body+=chunk}const input=JSON.parse(body);validate(input.state);if(!Number.isInteger(input.revision)||input.revision<0)return json(400,{error:'Revisão inválida.'});const result=db.prepare('UPDATE workspace SET state=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(input.state),input.revision);if(!result.changes)return json(409,{error:'Outra aba alterou a base. Dados atualizados; repita a alteração.'});return json(200,{revision:input.revision+1})}catch(e){return json(400,{error:e.message})}
}
if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Método não permitido.'});
try{const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));if(!file.startsWith(root.endsWith(sep)?root:root+sep))return json(403,{error:'Caminho não permitido.'});const content=readFileSync(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content)}catch{return json(404,{error:'Não encontrado.'})}
});
server.listen(port,'127.0.0.1',()=>console.log(`Workload Funcionários: http://localhost:${port}\nBanco local: ${resolve(data,'workload.sqlite')}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}));
