import {employeeDepartments, legacyDepartment} from './departments.js';

const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim().replace(/[^a-z0-9]+/g,' ');
const columns={
 name:['nome','nome completo','nome de exibicao','nome do funcionario','funcionario','name'],
 role:['funcao','cargo','ocupacao','role','job title'],
 code:['matricula','matricula unica','codigo','registro','code'],
 department:['departamento','setor','area','department']
};
function delimiterOf(text){
 let quoted=false,counts={',':0,';':0,'\t':0};
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){if(quoted&&text[i+1]==='"'){i++;continue}quoted=!quoted;continue}
  if(!quoted&&(char==='\r'||char==='\n'))break;
  if(!quoted&&Object.hasOwn(counts,char))counts[char]++;
 }
 return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
}
function rowsOf(text,delimiter){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++}
   else if(quoted)quoted=false;
   else if(field.length===0)quoted=true;
   else throw Error('O CSV contém aspas fora de lugar.');
  }else if(!quoted&&char===delimiter){row.push(field);field=''}
  else if(!quoted&&(char==='\r'||char==='\n')){
   row.push(field);if(row.some(value=>value.trim()))rows.push(row);
   row=[];field='';if(char==='\r'&&text[i+1]==='\n')i++;
  }else field+=char;
 }
 if(quoted)throw Error('O CSV contém um campo com aspas não fechadas.');
 row.push(field);if(row.some(value=>value.trim()))rows.push(row);
 return rows;
}
export function parseEmployeeCsv(text){
 if(typeof text!=='string'||!text.trim())throw Error('O arquivo CSV está vazio.');
 const rows=rowsOf(text.replace(/^\uFEFF/,''),delimiterOf(text));
 if(rows.length<2)throw Error('O CSV precisa ter um cabeçalho e pelo menos um funcionário.');
 const headers=rows[0].map(normalize),indexes={};
 for(const [key,aliases] of Object.entries(columns)){
  indexes[key]=headers.findIndex(header=>aliases.includes(header));
  if(indexes[key]<0&&(key==='name'||key==='department'))throw Error(`Coluna obrigatória não encontrada: ${key==='department'?'Departamento ou Setor':'Nome'}.`);
 }
 const departmentNames=new Map(employeeDepartments.map(department=>[normalize(department),department]));
 const employees=[],codes=new Set();
 for(let i=1;i<rows.length;i++){
  const row=rows[i],line=i+1;
  const employee=Object.fromEntries(Object.entries(indexes).map(([key,index])=>[key,index<0?'':(row[index]||'').trim()]));
  for(const [key,label] of [['name','Nome'],['department','Departamento']])
   if(!employee[key])throw Error(`Linha ${line}: preencha a coluna ${label}.`);
  const department=departmentNames.get(normalize(employee.department));
  if(!department||department===legacyDepartment)throw Error(`Linha ${line}: departamento "${employee.department}" não está cadastrado.`);
  employee.department=department;
  if(!employee.role)employee.role=department;
  const codeKey=normalize(employee.code);
  if(codeKey&&codes.has(codeKey))throw Error(`Linha ${line}: matrícula "${employee.code}" está repetida no arquivo.`);
  if(codeKey)codes.add(codeKey);employees.push(employee);
  if(employees.length>10000)throw Error('O arquivo excede o limite de 10.000 funcionários por importação.');
 }
 return employees;
}
