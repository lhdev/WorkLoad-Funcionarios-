import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
test('API: persiste em SQLite, rejeita conflito, valida dados e protege origem',async()=>{
const dir=mkdtempSync(join(tmpdir(),'workload-test-')),port=4189,url='http://localhost:'+port;let child;
const start=()=>new Promise((resolve,reject)=>{child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),WORKLOAD_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});child.once('error',reject);child.stdout.once('data',resolve);child.once('exit',code=>{if(code)reject(Error('Servidor de teste encerrou: '+code))})});
const stop=async()=>{if(!child)return;const done=once(child,'exit');child.kill();await done;child=null};
try{await start();assert.equal((await fetch(url)).status,200);assert.equal((await fetch(url+'/vendor/leaflet.js')).status,200);let data=await fetch(url+'/api/state').then(r=>r.json());assert.equal(data.state.projects.length,16);const next=structuredClone(data);next.state.projects[0].name='Obra de teste persistente';next.state.measurements=[{id:'m1',projectId:next.state.projects[0].id,date:'2026-04-01',progress:35,note:'Medição de teste'}];const put=body=>fetch(url+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal((await put(next)).status,200);assert.equal((await put(next)).status,409);data=await fetch(url+'/api/state').then(r=>r.json());data.state.employees[0].projectId='inexistente';assert.equal((await put(data)).status,400);assert.equal((await fetch(url+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://externo.example'},body:JSON.stringify(next)})).status,403);await stop();await start();data=await fetch(url+'/api/state').then(r=>r.json());assert.equal(data.state.projects[0].name,'Obra de teste persistente');assert.equal(data.state.measurements[0].progress,35);assert.equal(data.revision,1)}finally{await stop();rmSync(dir,{recursive:true,force:true})}
});
