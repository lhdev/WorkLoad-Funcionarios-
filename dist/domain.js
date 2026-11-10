import {departments, employeeDepartments, legacyDepartment} from './departments.js';

export const statuses=['Planejada','Ativa','Pausada','Concluída'];
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const days=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
export function projectProgress(project,date=today()){
 if(project.status==='Concluída')return 100;
 const duration=days(project.start,project.end);
 if(duration<=0)return date<project.start?0:100;
 return Math.round(Math.max(0,Math.min(1,days(project.start,date)/duration))*100);
}
export const team=(s,id)=>s.employees.filter(e=>e.projectId===id);
export function migrate(s){
 if(!s||s.version!==1||!Array.isArray(s.employees))throw Error('Backup inválido ou versão incompatível.');
 const next=structuredClone(s);
 for(const employee of next.employees)if(!Object.hasOwn(employee,'department'))employee.department=legacyDepartment;
 for(const project of next.projects){
  if(!project.departmentMinimums)project.departmentMinimums=Object.fromEntries(departments.map(department=>[department,0]));
  else if(typeof project.departmentMinimums==='object'&&!Array.isArray(project.departmentMinimums)){
   const previous=project.departmentMinimums;
   project.departmentMinimums=Object.fromEntries(departments.map(department=>[department,Object.hasOwn(previous,department)?previous[department]:0]));
  }
 }
 return next;
}
export function alerts(s,date=today()){return s.projects.flatMap(p=>{if(p.status==='Concluída')return [];const a=[];const add=(type,text,id=type)=>a.push({id:p.id+id,projectId:p.id,type,text,critical:type!=='soon'});if(p.status==='Ativa'&&!p.responsibles.length)add('owner','Obra ativa sem responsável');const members=team(s,p.id);for(const department of departments){const minimum=p.departmentMinimums?.[department]||0,count=members.filter(e=>e.department===department).length;if(count<minimum)add('staffing',`Faltam ${minimum-count} ${minimum-count===1?'funcionário':'funcionários'} de ${department} (${count}/${minimum})`,`staffing-${department}`)}const d=days(date,p.end);if(d<0)add('late',`Prazo vencido há ${-d} dias`);else if(d<=s.settings.warningDays)add('soon',`Conclusão em ${d} dias`);return a;});}
export function transfer(s,employeeId,target){const e=s.employees.find(e=>e.id===employeeId);if(!e)throw Error('Funcionário não encontrado.');if(target&&!s.projects.some(p=>p.id===target))throw Error('Projeto não encontrado.');if(target&&s.projects.find(p=>p.id===target).status==='Concluída')throw Error('Reabra o projeto antes de alocar funcionários.');if(e.projectId===target)return s;const next=structuredClone(s);const source=next.projects.find(p=>p.id===e.projectId);if(source)source.responsibles=source.responsibles.filter(id=>id!==e.id);next.employees.find(x=>x.id===e.id).projectId=target;next.history.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),employee:e.name,from:source?.name||'Sem alocação',to:next.projects.find(p=>p.id===target)?.name||'Sem alocação',action:'Transferência'});return next;}
export function validate(s){
 if(!s||s.version!==1||!Array.isArray(s.projects)||!Array.isArray(s.employees)||!Array.isArray(s.history))throw Error('Backup inválido ou versão incompatível.');
 if(s.projects.length>1000||s.employees.length>10000||s.history.length>50000)throw Error('Limite de registros excedido.');
 const str=(x,n=200)=>typeof x==='string'&&x.length<=n;const required=x=>str(x)&&x.trim().length>0;const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 const unique=arr=>arr.every(x=>required(x.id))&&new Set(arr.map(x=>x.id)).size===arr.length;
 if(!unique(s.projects)||!unique(s.employees))throw Error('Identificadores inválidos ou duplicados.');
 if(!s.settings||!Number.isInteger(s.settings.warningDays)||s.settings.warningDays<1||s.settings.warningDays>180)throw Error('Alerta deve ser entre 1 e 180 dias.');
 for(const e of s.employees)if(!required(e.name)||!required(e.role)||!str(e.code)||!employeeDepartments.includes(e.department)||!str(e.color,30)||(e.projectId!==null&&!s.projects.some(p=>p.id===e.projectId)))throw Error('Funcionário inválido ou alocação inexistente.');
 const codes=s.employees.map(e=>e.code.trim().toLocaleLowerCase('pt-BR')).filter(Boolean);if(new Set(codes).size!==codes.length)throw Error('A matrícula deve ser única.');
 for(const p of s.projects){if(!required(p.name)||!required(p.city)||!str(p.uf,2)||!/^([A-Z]{2})$/.test(p.uf)||!statuses.includes(p.status)||!date(p.start)||!date(p.end)||p.end<p.start||!Number.isFinite(p.lat)||p.lat< -34||p.lat>6||!Number.isFinite(p.lng)||p.lng< -74||p.lng> -28||!Number.isFinite(p.progress)||p.progress<0||p.progress>100||!p.departmentMinimums||typeof p.departmentMinimums!=='object'||Array.isArray(p.departmentMinimums)||Object.keys(p.departmentMinimums).length!==departments.length||departments.some(department=>!Number.isInteger(p.departmentMinimums[department])||p.departmentMinimums[department]<0||p.departmentMinimums[department]>10000)||!Array.isArray(p.responsibles)||new Set(p.responsibles).size!==p.responsibles.length||!p.responsibles.every(id=>s.employees.some(e=>e.id===id&&e.projectId===p.id))||!str(p.goals,5000)||!p.fields||typeof p.fields!=='object'||Array.isArray(p.fields)||Object.entries(p.fields).some(([k,v])=>!required(k)||!str(v,1000)))throw Error('Projeto inválido: confira datas, coordenadas, progresso, mínimos por departamento e responsáveis da equipe.');}
 for(const h of s.history)if(!required(h.id)||!str(h.at)||isNaN(Date.parse(h.at))||!str(h.employee)||!str(h.from)||!str(h.to)||!str(h.action))throw Error('Histórico inválido.');return s;
}
