import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEmployeeCsv} from '../dist/employee-csv.js';
import {departments} from '../dist/departments.js';

test('Importa CSV de Excel com BOM, ponto e vírgula e aspas escapadas',()=>{
 const employees=parseEmployeeCsv('\uFEFFNome;Função;Matrícula;Departamento\r\n"Ana, ""Aninha""";Engenheira;A-1;seguranca do trabalho\r\nBia;Técnica;A-2;Almoxarifado');
 assert.deepEqual(employees,[
  {name:'Ana, "Aninha"',role:'Engenheira',code:'A-1',department:departments[0]},
  {name:'Bia',role:'Técnica',code:'A-2',department:'Almoxarifado'}
 ]);
});

test('Importa CSV separado por vírgula e normaliza nomes de coluna',()=>{
 const employees=parseEmployeeCsv('Nome completo,Função,Matrícula única,Departamento\nCaio,"Técnico, nível 2",007,Eletricista');
 assert.deepEqual(employees,[{name:'Caio',role:'Técnico, nível 2',code:'007',department:'Eletricista'}]);
});

test('Importa CSV com apenas NOME e SETOR, usando SETOR como função e sem matrícula',()=>{
 const employees=parseEmployeeCsv('\uFEFFNOME;SETOR\nAlan Nunes Pina;Seguranca do Trabalho\nAna Claudia dos Santos Silva;Seguranca do Trabalho');
 assert.deepEqual(employees,[
  {name:'Alan Nunes Pina',role:departments[0],code:'',department:departments[0]},
  {name:'Ana Claudia dos Santos Silva',role:departments[0],code:'',department:departments[0]}
 ]);
});

test('Importa CSV com setor SPCS',()=>{
 assert.deepEqual(parseEmployeeCsv('NOME;SETOR\nPessoa de exemplo;SPCS'),[
  {name:'Pessoa de exemplo',role:'SPCS',code:'',department:'SPCS'}
 ]);
});

test('Recusa cabeçalho incompleto, departamento desconhecido e matrícula repetida',()=>{
 assert.throws(()=>parseEmployeeCsv('Função,Matrícula\nTécnica,1'),/Nome/);
 assert.throws(()=>parseEmployeeCsv('Nome;Função;Matrícula;Departamento\nAna;Técnica;1;Outro'),/Linha 2.*departamento/);
 assert.throws(()=>parseEmployeeCsv('Nome;Função;Matrícula;Departamento\nAna;Técnica;1;SPCS\nBia;Técnica;1;SPCS'),/Linha 3.*repetida/);
});

test('Recusa CSV malformado e vazio',()=>{
 assert.throws(()=>parseEmployeeCsv('Nome;Função;Matrícula;Departamento\n"Ana;Técnica;1;SPCS'),/aspas não fechadas/);
 assert.throws(()=>parseEmployeeCsv(''),/vazio/);
});
