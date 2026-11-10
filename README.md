# Workload Funcionários

Aplicativo web funcional em português brasileiro para gestão de alocação por obra. Inclui 16 projetos em 16 estados e 48 funcionários fictícios. As coordenadas são dos projetos; o aplicativo não solicita geolocalização nem rastreia pessoas.

## Executar no computador

Requisito: **Node.js 24 ou superior**. Não é necessário instalar pacotes.

1. Abra um terminal nesta pasta.
2. Execute `npm start`.
3. Abra **http://localhost:4173**.
4. Mantenha o terminal aberto durante o uso. Para encerrar, pressione Ctrl+C.

No Windows também é possível executar `iniciar.cmd`. Não abra `index.html` diretamente, porque os módulos JavaScript precisam de um servidor HTTP.

A primeira execução cria `data/workload.sqlite` e carrega a demonstração. Reiniciar o servidor mantém a base. O módulo SQLite integrado do Node 24 pode emitir um aviso de recurso experimental; não impede a execução.

Para escolher outra porta no PowerShell:

```powershell
$env:PORT = '4180'
npm start
```

`WORKLOAD_DATA_DIR` permite escolher outra pasta para o banco. Prefira uma pasta de dados local fora de sincronização simultânea pelo OneDrive; use o backup JSON para transporte. Não abra o mesmo arquivo SQLite simultaneamente em computadores diferentes.

## Modos de persistência

| Execução | Onde os dados ficam | Limite de uso |
| --- | --- | --- |
| `npm start` | SQLite no servidor local | Um espaço de trabalho neste computador; várias abas com revisão e detecção de conflito |
| Demonstração hospedada / arquivos de `dist` em servidor estático | `localStorage` do navegador | Uso individual em uma aba, sem sincronização entre dispositivos |

`runtime.js` declara o modo estático. O servidor Node responde a esse arquivo com a configuração de SQLite. Falhas do servidor não provocam troca silenciosa para outra base. Nenhum dado do SQLite local é enviado à versão hospedada; a demonstração hospedada é inicializada separadamente.

Os dados do navegador pertencem à origem e ao perfil utilizado. Excluir o armazenamento do site apaga essa base. Exporte backups regulares em **Configurações → Exportar backup JSON**. O botão Exportar dados no cabeçalho também gera o backup completo. A versão hospedada é uma demonstração privada, não um backend compartilhado.

## Como usar

- **Dashboard:** indicadores, distribuição de equipes, progresso físico, prazo decorrido, duração total prevista e dias restantes. Busca, status e UF filtram as obras e os indicadores; os totais gerais de funcionários disponíveis continuam identificados como totais da base. O gráfico exibe as seis maiores equipes; a tabela contém todas as obras filtradas.
- **Mapa de obras:** zoom, arraste, pins e lista de projetos. Selecione um pin para ver cidade/UF, equipe, status, progresso e responsáveis. Selecione Ver projeto para editar. As coordenadas iniciais representam centros das cidades da demonstração; substitua pelas coordenadas reais das obras.
- **Alocação de equipe:** colunas por obra e Sem alocação. Arraste um cartão entre colunas. A ação só é gravada após confirmação. No celular ou pelo teclado, use Mover. Role o quadro horizontalmente para acessar as demais obras.
- **Cronograma:** grade diária por mês com os funcionários agrupados pelos projetos atuais. As barras usam as datas previstas do projeto e suas cores indicam o status; é possível filtrar por mês, departamento, busca, status e UF. O cronograma não representa histórico individual de alocações.
- **Curva S:** selecione um projeto e registre medições periódicas do avanço físico real (0–100%). O gráfico compara essas medições com uma referência planejada linear entre início e término. A primeira medição inicia a série real; o sistema não inventa histórico. É possível atualizar a medição do mesmo projeto na mesma data.
- **KPIs:** mostra carteira filtrada, obras ativas e vencidas, cobertura de medições, avanço real médio, desvio em pontos percentuais e alertas de equipe. Médias de avanço/desvio consideram apenas projetos com medição.
- **Gantt:** apresenta as datas planejadas e a posição de hoje por projeto. O preenchimento usa a última medição real quando disponível; sem medição, usa a estimativa automática por tempo decorrido. Busca, status e UF filtram a carteira exibida.
- **Projetos:** criar, consultar, editar e excluir. Configure nome, cidade, UF, coordenadas, datas, status, mínimos de funcionários por departamento, metas e campos adicionais com nome/valor (cliente, contrato, fase, orçamento etc.). O progresso é calculado automaticamente pelo tempo decorrido entre início e conclusão prevista. Os campos adicionais são específicos de cada projeto e podem ser acrescentados/removidos. Aloque a equipe pelo quadro e então selecione um ou vários responsáveis no formulário do projeto.
- **Funcionários:** criar, editar, consultar, excluir e realocar. Importe vários funcionários de uma vez por CSV na tela Funcionários; use **Baixar modelo CSV** para obter um arquivo pronto com as colunas `NOME` e `SETOR`. O arquivo precisa conter Nome e Departamento ou Setor; Função e Matrícula são opcionais. Se Função não for informada, o departamento será usado também como função; matrículas preenchidas precisam ser únicas. Os funcionários importados ficam sem alocação e não substituem registros existentes. No cadastro individual, selecione o departamento na lista logo abaixo do nome; a lista é agrupada e filtrável por Segurança do Trabalho, Eletricista, Engenheiro civil, Engenheiro elétrico, SPCS e Almoxarifado. Nenhuma informação pessoal real é necessária.
- **Central de alertas:** selecione um alerta para abrir o projeto e corrigir sua causa.
- **Histórico:** registra transferências, criação, edição, exclusão e desalocação por exclusão de projeto. Os registros preservam os nomes dos projetos e das pessoas no momento do evento.
- **Configurações:** antecedência dos alertas, exportação, importação e criação de base vazia.

## Regras e validações

1. Projeto Ativo sem responsáveis gera alerta crítico. Responsáveis devem integrar a equipe da própria obra.
2. Cada projeto permite definir um número mínimo de funcionários para cada departamento. Quando a equipe alocada fica abaixo do mínimo, é gerado um alerta com a quantidade faltante; mínimo zero não gera alerta de equipe.
3. Prazo vencido gera alerta; prazo em até 14 dias por padrão gera aviso. A antecedência é configurável entre 1 e 180 dias.
4. Projetos Concluídos não geram alertas e não recebem novas alocações até serem reabertos.
5. Transferir um responsável remove sua designação na origem, sem designá-lo automaticamente no destino. Antes de confirmar, a interface destaca a retirada e os novos alertas de origem (inclusive se ficar sem responsável ou sem equipe). A transferência é permitida após confirmação explícita; o alerta permanece visível até correção. Não há bloqueio absoluto de obras sem responsável, pois o cadastro inicial pode estar incompleto.
6. Excluir obra pede confirmação, preserva o histórico e envia a equipe para Sem alocação. Excluir funcionário remove suas designações e avisa se ele era responsável.
7. Datas devem existir, e fim deve ser igual ou posterior ao início. O progresso linear pelo tempo decorrido fica entre 0 e 100; projetos concluídos exibem 100%. Latitude e longitude precisam estar no intervalo geográfico aproximado do Brasil. A validação de coordenadas é por faixa, não por geocodificação ou conferência exata de fronteira.
8. Backups passam por validação de versão, tipos, identificadores únicos, matrículas e integridade das referências. A importação substitui a base inteira somente após confirmação. Limite de 5 MB por gravação/importação; até 1.000 projetos, 10.000 funcionários e 50.000 eventos no esquema. Esses limites são de validação, não garantia de desempenho nesses volumes.

Os prazos usam dias corridos e a data corrente em America/Sao_Paulo. Datas da interface usam pt-BR. Tempo restante é uma diferença entre a data atual e a conclusão prevista, não uma previsão baseada em produtividade. O progresso estimado corresponde ao percentual do prazo decorrido. As medições reais são registros manuais cumulativos por projeto/data; a referência planejada linear é indicativa, não uma linha de base aprovada ou uma curva de custo. A base antiga é migrada sem perda e inicia com a lista de medições vazia. Os alertas são recalculados ao navegar/alterar a base; não há envio de e-mail ou notificação em segundo plano.

## Substituir a demonstração por dados reais

1. Exporte o backup fictício como referência.
2. Em Configurações, selecione Criar base vazia e confirme.
3. Cadastre projetos e importe funcionários por CSV pela tela Funcionários. A primeira linha deve conter `Nome` e `Departamento` ou `Setor`; `Função` e `Matrícula` são opcionais. Se Função for omitida, o departamento será usado como função. Use vírgula ou ponto e vírgula como separador. Excel com CSV separado por ponto e vírgula e UTF-8 com BOM é compatível. Os departamentos devem corresponder às opções cadastradas. A importação adiciona os funcionários à base atual, não substitui registros, e todos entram sem alocação.
4. Defina coordenadas, datas, metas e campos adicionais dos projetos.
5. Aloque funcionários e designe os responsáveis de cada obra.
6. Confira os alertas e exporte o primeiro backup real.

Também é possível editar uma cópia do backup JSON e importá-la. Preserve `version: 1`, `settings`, os identificadores únicos e as referências: `employee.projectId` deve ser `null` ou um ID existente, e `project.responsibles` contém IDs de funcionários alocados nesse projeto. Valores de campos adicionais são texto. O arquivo `dist/seed.js` contém o gerador de demonstração, executado apenas quando ainda não há base.

Funcionários de bases ou backups anteriores, que ainda não tenham o campo `department`, são migrados sem alterar `version: 1` e aparecem como **Não definido**. Atribua o departamento correto ao editar o cadastro; a migração não tenta deduzir a área pela função.

Não inclua documentos, salários, localização individual ou outros dados pessoais desnecessários. Se importar uma base real na versão hospedada, os registros ficam no navegador; para uso regular, prefira o servidor local ou uma implantação empresarial com controle de acesso.

## Arquitetura e edição

- `dist/index.html` e `dist/styles.css`: estrutura e interface responsiva.
- `dist/app.js`: páginas, mapa, Kanban, formulários, confirmação, backup e persistência.
- `dist/domain.js`: validações, alertas, calendário e transferências; compartilhado pelo frontend e backend.
- `dist/departments.js`: catálogo único de departamentos utilizado na validação, nos formulários e na listagem.
- `dist/employee-csv.js`: leitura e validação de arquivos CSV de funcionários.
- `dist/schedule.css`: grade mensal do cronograma por projeto e funcionário.
- `dist/seed.js`: dados inteiramente fictícios, com datas relativas ao primeiro acesso.
- `dist/runtime.js`: seleciona o modo do armazenamento em hospedagem estática.
- `server.mjs`: servidor HTTP e API `GET /api/state`, `PUT /api/state`.
- `data/workload.sqlite`: banco criado em execução e excluído do versionamento.
- `tests/`: testes de regras e da API, com banco temporário isolado.

Frontend em JavaScript nativo com Leaflet 1.9.4 incluído em `dist/vendor` (licença BSD-2-Clause no mesmo diretório). Sem etapa de compilação. Node.js fornece HTTP e SQLite, sem dependências de backend. O banco mantém um snapshot JSON com revisão incremental e atualização condicional atômica para impedir sobrescritas entre abas. Em conflito, a interface carrega a nova revisão e solicita repetir a alteração.

O mapa base usa tiles do OpenStreetMap e exige internet, conforme a [política de utilização](https://operations.osmfoundation.org/policies/tiles/). As fontes opcionais são carregadas do Google Fonts, com fontes locais de reserva. A biblioteca do mapa é incluída no projeto; cadastros e quadro funcionam sem esses serviços externos após o app carregar. Para tráfego elevado, contrate um provedor de mapas e altere o endereço de tiles em `drawMap`.

O servidor vincula apenas `127.0.0.1`, valida Host/Origin e aceita JSON na escrita. Não há login, papéis por usuário, anexos, atualização em tempo real ou trilha de auditoria inviolável. O histórico acompanha o workspace e pode ser substituído por um backup. Antes de disponibilizar um backend em rede ou para várias pessoas, implementar autenticação, autorização, HTTPS, auditoria no servidor, backup automatizado e migração do snapshot para tabelas relacionais/API por entidade. O MVP atual foi dimensionado para uso local e demonstração individual.

## Verificação

```text
npm run check
npm test
```

Os testes cobrem a base inicial, transferências, retirada do último responsável e da última pessoa, prazos, datas inválidas, matrículas duplicadas, relações órfãs, importações inválidas, persistência após reinício, conflito de revisão e recusa de origem externa. A interface também foi conferida no navegador em desktop e celular, incluindo confirmação com aviso de responsável, movimentação com histórico, cadastro salvo e mapa carregado.

Referências de implementação: [SQLite no Node.js](https://nodejs.org/api/sqlite.html) e [Leaflet](https://leafletjs.com/).
