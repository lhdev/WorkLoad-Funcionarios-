export const departments = Object.freeze([
  'Segurança do Trabalho',
  'Eletricista',
  'Engenheiro civil',
  'Engenheiro elétrico',
  'SPCS',
  'Almoxarifado',
  'Projetista',
  'Service',
]);

export const legacyDepartment = 'Não definido';
export const employeeDepartments = Object.freeze([...departments, legacyDepartment]);
