import { seed } from "./seed.js";
import {
  today,
  days,
  team,
  alerts,
  transfer,
  validate,
  migrate,
  statuses,
  projectProgress,
  measuredProgress,
} from "./domain.js";
import {
  departments,
  employeeDepartments,
  legacyDepartment,
} from "./departments.js";
import { parseEmployeeCsv } from "./employee-csv.js";
const $ = (s) => document.querySelector(s),
  esc = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const icons = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15",
  board: "M3 4h18v16H3z M9 4v16 M15 4v16 M5 8h2 M11 8h2 M17 8h2",
  project: "M3 21V7h10v14 M13 12h8v9 M6 10h4 M6 14h4 M6 18h4 M16 15h2 M16 18h2",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  alert: "m12 3 10 18H2z M12 9v4 M12 17h.01",
  history: "M3 11a9 9 0 1 1 2 7 M3 3v8h8 M12 7v5l3 2",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  search: "m21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  plus: "M12 5v14 M5 12h14",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
  clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  check: "m5 12 4 4L19 6",
  curve: "M3 19c4-1 5-12 9-12s4 10 9 10 M3 21h18 M3 21V3",
  kpi: "M4 19V9 M10 19V5 M16 19v-7 M22 19H2",
  gantt: "M3 5h8 M3 10h14 M3 15h11 M3 20h17",
};
const icon = (n) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n] || icons.project}"/></svg>`;
const button = (text, action, id = "", cls = "secondary") =>
  `<button class="${cls}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;
const fmt = (d) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(d + "T12:00:00"));
const initials = (n) =>
  n
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
const avatar = (e) =>
  `<span class="avatar" style="background:${/^#[0-9a-f]{6}$/i.test(e.color) ? e.color : "#275d70"}" title="${esc(e.name)}">${esc(initials(e.name))}</span>`;
const badge = (p) =>
  `<span class="badge ${p.status === "Ativa" ? "green" : p.status === "Pausada" ? "amber" : p.status === "Concluída" ? "blue" : "gray"}"><i></i>${esc(p.status)}</span>`;
let state,
  mode = "browser",
  revision = 0,
  page = "dashboard",
  query = "",
  statusFilter = "",
  ufFilter = "",
  departmentFilter = "",
  curveProjectId = "",
  map,
  dragId = null,
  saving = false;
const key = "workload-funcionarios-v1";
function toast(text, error = false) {
  $("#toast").textContent = text;
  $("#toast").className = "show" + (error ? " error" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").className = ""), 5000);
}
async function init() {
  try {
    const r =
      globalThis.WORKLOAD_MODE === "server"
        ? await fetch("./api/state", { cache: "no-store" })
        : { status: 404 };
    if (r.ok) {
      const data = await r.json();
      state = validate(migrate(data.state));
      revision = data.revision;
      mode = "server";
    } else if (r.status === 404) {
      const raw = localStorage.getItem(key);
      state = raw ? validate(migrate(JSON.parse(raw))) : seed();
      if (!raw) localStorage.setItem(key, JSON.stringify(state));
    } else
      throw Error("Servidor indisponível. Seus dados não foram substituídos.");
    render();
  } catch (e) {
    $("#app").innerHTML =
      `<main class="fatal"><h1>Não foi possível abrir a base</h1><p>${esc(e.message)}</p><p>Confira o servidor ou o armazenamento do navegador. Uma base existente nunca é substituída automaticamente.</p><button onclick="location.reload()">Tentar novamente</button></main>`;
  }
}
async function persist(next, message) {
  if (saving) return false;
  try {
    validate(next);
    saving = true;
    $("#app").classList.add("saving");
    if (mode === "server") {
      const r = await fetch("./api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: next, revision }),
      });
      if (!r.ok) {
        const d = await r.json();
        if (r.status === 409) {
          const fresh = await fetch("./api/state", { cache: "no-store" }).then(
            (r) => r.json(),
          );
          state = validate(migrate(fresh.state));
          revision = fresh.revision;
          render();
        }
        throw Error(d.error || "Falha ao salvar.");
      }
      revision = (await r.json()).revision;
    } else localStorage.setItem(key, JSON.stringify(next));
    state = next;
    render();
    if (message) toast(message);
    return true;
  } catch (e) {
    toast(e.message, true);
    return false;
  } finally {
    saving = false;
    $("#app").classList.remove("saving");
  }
}
const selected = () =>
  state.projects.filter(
    (p) =>
      (!query ||
        [p.name, p.city, p.uf, ...team(state, p.id).map((e) => e.name)]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR"))) &&
      (!statusFilter || p.status === statusFilter) &&
      (!ufFilter || p.uf === ufFilter),
  );
const nav = [
  ["dashboard", "dashboard", "Dashboard"],
  ["map", "map", "Mapa de obras"],
  ["board", "board", "Alocação de equipe"],
  ["projects", "project", "Projetos"],
  ["employees", "people", "Funcionários"],
  ["alerts", "alert", "Central de alertas"],
  ["history", "history", "Histórico"],
  ["curve-s", "curve", "Curva S"],
  ["kpis", "kpi", "KPIs"],
  ["gantt", "gantt", "Gantt"],
];
const titles = {
  dashboard: [
    "Visão geral da operação",
    "Cada obra no seu lugar. Cada pessoa fazendo a diferença.",
  ],
  map: [
    "Sua operação no mapa",
    "Explore os projetos e as equipes em todo o Brasil.",
  ],
  board: [
    "Pessoas no projeto certo",
    "Arraste os cartões ou use “Mover” para realocar a equipe.",
  ],
  projects: [
    "Projetos e obras",
    "Acompanhe os detalhes, os responsáveis e as entregas.",
  ],
  employees: ["Nossa equipe", "Pessoas, funções e alocações em um só lugar."],
  alerts: [
    "Central de alertas",
    "Antecipe riscos e mantenha cada obra acompanhada.",
  ],
  history: [
    "Histórico da operação",
    "Um registro das alocações e alterações realizadas.",
  ],
  "curve-s": [
    "Curva S de avanço físico",
    "Compare o avanço planejado pelo prazo com as medições reais registradas.",
  ],
  kpis: [
    "Indicadores da operação",
    "Acompanhe prazos, medições, avanço e alertas de equipe.",
  ],
  gantt: [
    "Gantt dos projetos",
    "Visualize durações planejadas, avanço e posição atual de cada obra.",
  ],
  settings: [
    "Configurações e dados",
    "Sua base organizada, com segurança e portabilidade.",
  ],
};
function render() {
  if (state)
    for (const project of state.projects)
      project.progress = projectProgress(project);
  if (map) {
    map.remove();
    map = null;
  }
  const all = alerts(state),
    projects = selected();
  $("#app").innerHTML =
    `<aside class="sidebar"><a href="#" class="brand" data-action="nav" data-id="dashboard"><span class="brand-mark">w<span>•</span></span><div>workload<small>FUNCIONÁRIOS</small></div></a><div class="workspace"><span class="workspace-icon">W</span><div>Gestão de operações<small>Visão nacional</small></div><span class="online"></span></div><small class="nav-label">PRINCIPAL</small><nav>${nav.map(([id, ic, title]) => `<button data-action="nav" data-id="${id}" aria-label="${title}" title="${title}" class="nav-item ${page === id ? "active" : ""}">${icon(ic)}<span>${title}</span>${id === "alerts" && all.length ? `<b>${all.length}</b>` : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="demo-note"><span class="online"></span> Ambiente de demonstração<small>Dados fictícios • sem GPS individual</small></div><button class="nav-item ${page === "settings" ? "active" : ""}" data-action="nav" data-id="settings">${icon("settings")}Configurações</button><div class="profile"><span class="avatar">OP</span><div>Gestão de operações<small>Espaço de trabalho local</small></div></div></div></aside><main><header class="topbar"><div><span class="breadcrumb">Workspace</span><span class="slash">/</span>${esc(nav.find((n) => n[0] === page)?.[2] || "Configurações")}</div><div class="top-actions"><span class="save-status"><i></i>${mode === "server" ? "SQLite conectado" : "Salvo neste navegador"}</span><button class="icon-button" title="Ver alertas" aria-label="Ver alertas" data-action="nav" data-id="alerts">${icon("alert")}<span class="notification">${all.length}</span></button><span class="avatar small">OP</span></div></header><div class="content"><div class="page-heading"><div><div class="eyebrow">OPERAÇÃO • BRASIL</div><h1>${titles[page][0]}</h1><p>${titles[page][1]}</p></div><div class="heading-actions">${button(icon("download") + " Exportar dados", "export")}${button(icon("plus") + (page === "employees" ? " Novo funcionário" : " Novo projeto"), page === "employees" ? "employee-new" : "project-new", "", "primary")}</div></div>${
      !["settings", "history"].includes(page)
        ? `<div class="filterbar"><label class="search">${icon("search")}<input id="search" placeholder="Buscar projeto, cidade ou pessoa…" aria-label="Buscar" value="${esc(query)}"></label><select id="status-filter" aria-label="Filtrar status"><option value="">Todos os status</option>${statuses.map((s) => `<option ${s === statusFilter ? "selected" : ""}>${s}</option>`).join("")}</select><select id="uf-filter" aria-label="Filtrar estado"><option value="">Todos os estados</option>${[
            ...new Set(state.projects.map((p) => p.uf)),
          ]
            .sort()
            .map(
              (uf) =>
                `<option ${uf === ufFilter ? "selected" : ""}>${uf}</option>`,
            )
            .join(
              "",
            )}</select><span class="filter-count">${projects.length} projetos</span>${query || statusFilter || ufFilter ? button("Limpar", "clear") : ""}</div>`
        : ""
    }<div id="page-content">${{ dashboard: dashboard, map: mapPage, board: board, projects: projectsPage, employees: employeesPage, alerts: alertsPage, history: historyPage, settings: settingsPage, "curve-s": curveSPage, kpis: kpisPage, gantt: ganttPage }[page](projects)}</div><footer>Workload Funcionários <span>•</span> ${mode === "server" ? "Persistência local em SQLite" : "Persistência no navegador • faça backups regulares"}<span>•</span> ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date())}</footer></div></main>`;
  wire();
  if (page === "map") drawMap(projects);
  if (page === "dashboard") drawMap(projects, true);
}
function empty(text = "Nenhum projeto encontrado.") {
  return `<div class="empty">${icon("search")}<h3>${text}</h3><p>Ajuste os filtros ou adicione um novo cadastro.</p></div>`;
}
function dashboard(ps) {
  const ids = new Set(ps.map((p) => p.id)),
    allocated = state.employees.filter((e) => ids.has(e.projectId)).length,
    active = ps.filter((p) => p.status === "Ativa"),
    a = alerts(state).filter((a) => ids.has(a.projectId)),
    avg = ps.length
      ? Math.round(ps.reduce((n, p) => n + p.progress, 0) / ps.length)
      : 0;
  return `<div class="stats"><article class="stat"><span>Projetos em operação ${icon("project")}</span><strong>${active.length.toString().padStart(2, "0")}</strong><small><b>${ps.length}</b> projetos no portfólio</small></article><article class="stat"><span>Funcionários alocados ${icon("people")}</span><strong>${allocated}</strong><small><b>${state.employees.filter((e) => !e.projectId).length}</b> disponíveis para alocação</small><div class="mini-avatars">${state.employees.slice(0, 5).map(avatar).join("")}</div></article><article class="stat"><span>Progresso médio ${icon("dashboard")}</span><strong>${avg}<em>%</em></strong><small>Média simples dos projetos filtrados</small><div class="progress"><i style="width:${avg}%"></i></div></article><article class="stat warning"><span>Pontos de atenção ${icon("alert")}</span><strong>${a.length.toString().padStart(2, "0")}</strong><small><b>${a.filter((x) => x.critical).length}</b> alertas críticos</small><button data-action="nav" data-id="alerts">Ver todos os alertas ↗</button></article></div><div class="dashboard-grid"><section class="panel national"><div class="panel-heading"><div><h2>Uma operação, todo o Brasil</h2><p>Distribuição geográfica dos projetos</p></div>${button("Explorar mapa ↗", "nav", "map", "text-button")}</div><div class="map-wrap compact"><div id="map"></div><div class="map-caption"><span class="dot"></span> Localização das obras</div></div><div class="map-legend"><span><i class="dot"></i> Ativa</span><span><i class="dot amber-dot"></i> Pausada / planejada</span><span><i class="dot blue-dot"></i> Concluída</span></div></section><section class="panel"><div class="panel-heading"><div><h2>Equipe por projeto</h2><p>Pessoas alocadas em cada obra</p></div><span class="soft-icon">${icon("people")}</span></div><div class="bar-chart">${
    ps
      .slice()
      .sort((a, b) => team(state, b.id).length - team(state, a.id).length)
      .slice(0, 6)
      .map((p) => {
        const count = team(state, p.id).length,
          max = Math.max(1, ...ps.map((x) => team(state, x.id).length));
        return `<button class="bar-row" data-action="project-detail" data-id="${esc(p.id)}"><span title="${esc(p.name)}">${esc(p.name)}</span><div><i style="width:${(count / max) * 100}%"></i></div><b>${count}</b></button>`;
      })
      .join("") || empty()
  }<small>Até 6 maiores equipes • consulte a tabela para todas as obras</small></div><div class="distribution"><div class="donut" style="--value:${state.employees.length ? (allocated / state.employees.length) * 100 : 0}%"><b>${allocated}<small>alocados</small></b></div><div><h3>Talentos em movimento</h3><p>${state.employees.length} funcionários no total</p>${button("Gerenciar alocação →", "nav", "board", "text-button")}</div></div></section></div><div class="section-title"><div><h2>Andamento das obras</h2><p>Prazos, pessoas e progresso de cada entrega.</p></div>${button("Ver projetos " + icon("arrow"), "nav", "projects")}</div>${projectTable(ps)}<div class="dashboard-grid lower"><section class="panel"><div class="panel-heading"><div><h2>Cronograma de execução</h2><p>Progresso físico e tempo decorrido</p></div>${icon("clock")}</div><div class="timeline">${ps
    .slice()
    .sort((a, b) => a.end.localeCompare(b.end))
    .slice(0, 6)
    .map((p) => {
      const elapsed = Math.max(
        0,
        Math.min(
          100,
          (days(p.start, today()) / Math.max(1, days(p.start, p.end))) * 100,
        ),
      );
      return `<div class="timeline-row"><div><b>${esc(p.name)}</b><small>${fmt(p.start)} → ${fmt(p.end)} · ${days(p.start, p.end)} dias</small></div><div class="timeline-track"><i style="width:${elapsed}%" title="${Math.round(elapsed)}% do prazo decorrido"></i><b style="width:${p.progress}%" title="${p.progress}% de progresso físico"></b></div><span>${p.progress}%</span></div>`;
    })
    .join(
      "",
    )}</div><p class="chart-note">Faixa clara: tempo decorrido · faixa verde: progresso físico</p></section><section class="panel"><div class="panel-heading"><div><h2>Precisa da sua atenção</h2><p>Riscos da operação selecionada</p></div><span class="count-tag">${a.length}</span></div><div class="attention-list">${
    a
      .slice(0, 4)
      .map((x) => alertCard(x))
      .join("") ||
    '<div class="empty">✓ Nenhum alerta para os filtros atuais.</div>'
  }</div>${button("Abrir central de alertas →", "nav", "alerts", "text-button full")}</section></div>`;
}
function projectTable(ps) {
  return ps.length
    ? `<div class="table-wrap"><table><thead><tr><th>PROJETO / LOCALIZAÇÃO</th><th>STATUS</th><th>EQUIPE</th><th>PROGRESSO</th><th>CONCLUSÃO</th><th></th></tr></thead><tbody>${ps
        .map((p) => {
          const t = team(state, p.id),
            d = days(today(), p.end);
          return `<tr><td><button class="project-name" data-action="project-detail" data-id="${esc(p.id)}"><span class="project-symbol">${icon("project")}</span><span><b>${esc(p.name)}</b><small>${esc(p.city)} · ${esc(p.uf)}</small></span></button></td><td>${badge(p)}</td><td><div class="team-avatars">${t.slice(0, 3).map(avatar).join("")}<span class="team-total">${t.length} ${t.length === 1 ? "pessoa" : "pessoas"}</span></div></td><td><div class="progress-cell"><div class="progress"><i style="width:${p.progress}%"></i></div><b>${p.progress}%</b></div></td><td><b class="date-value">${fmt(p.end)}</b><small class="${d < 0 && p.status !== "Concluída" ? "danger-text" : ""}">${p.status === "Concluída" ? "Concluída" : d < 0 ? `${-d} dias de atraso` : `${d} dias restantes`}</small></td><td>${button("Detalhes ↗", "project-detail", p.id, "text-button")}</td></tr>`;
        })
        .join("")}</tbody></table></div>`
    : empty();
}
function mapPage(ps) {
  return `<div class="map-layout"><section class="panel"><div class="panel-heading"><div><h2>Projetos pelo Brasil</h2><p>Selecione um pin para consultar a equipe e os detalhes.</p></div>${button("Enquadrar Brasil", "map-fit")}</div><div class="map-wrap expanded"><div id="map"></div></div><div class="map-legend">${icon("map")} Coordenadas dos projetos cadastrados. Não há rastreamento individual.</div></section><section class="panel map-projects"><div class="panel-heading"><h2>${ps.length} obras no mapa</h2></div>${ps.map((p) => `<button class="map-list-item" data-action="map-select" data-id="${esc(p.id)}"><span class="dot ${p.status === "Ativa" ? "" : p.status === "Concluída" ? "blue-dot" : "amber-dot"}"></span><div><b>${esc(p.name)}</b><small>${esc(p.city)} · ${esc(p.uf)} · ${team(state, p.id).length} pessoas</small></div>${icon("arrow")}</button>`).join("") || empty()}</section></div>`;
}
let markers = {};
function drawMap(ps, compact = false) {
  if (!window.L) {
    $("#map").innerHTML =
      '<div class="empty">Mapa indisponível. Os projetos continuam disponíveis na lista.</div>';
    return;
  }
  map = L.map("map", { scrollWheelZoom: !compact, zoomControl: true }).setView(
    [-14.5, -51],
    compact ? 3 : 4,
  );
  markers = {};
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  ps.forEach((p) => {
    const t = team(state, p.id);
    const marker = L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        className: "custom-pin",
        html: `<span class="pin ${p.status === "Ativa" ? "" : p.status === "Concluída" ? "blue-pin" : "amber-pin"}">${t.length}</span>`,
        iconSize: [30, 36],
        iconAnchor: [15, 36],
      }),
    }).addTo(map);
    marker.bindPopup(
      `<div class="pin-popup">${badge(p)}<h3>${esc(p.name)}</h3><p>${esc(p.city)} · ${esc(p.uf)}</p><b>${t.length} funcionários · ${p.progress}% concluído</b><p>Responsáveis: ${p.responsibles.map((id) => esc(state.employees.find((e) => e.id === id)?.name)).join(", ") || "Não designados"}</p><p>Equipe: ${t.map((e) => esc(e.name)).join(", ") || "Sem funcionários"}</p><button class="primary" data-action="project-detail" data-id="${esc(p.id)}">Ver projeto →</button></div>`,
    );
    markers[p.id] = marker;
  });
  if (ps.length)
    map.fitBounds(L.latLngBounds(ps.map((p) => [p.lat, p.lng])), {
      padding: [35, 35],
      maxZoom: ps.length === 1 ? 8 : 5,
    });
  L.control.scale({ imperial: false }).addTo(map);
}
function board(ps) {
  const allowed = new Set(ps.map((p) => p.id)),
    matches = (e) =>
      !query ||
      [
        e.name,
        e.role,
        e.code,
        state.projects.find((p) => p.id === e.projectId)?.name || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
  const allProjects = state.projects.filter(
    (p) =>
      (!statusFilter || p.status === statusFilter) &&
      (!ufFilter || p.uf === ufFilter) &&
      (allowed.has(p.id) || team(state, p.id).some(matches)),
  );
  return `<div class="board-note">${icon("check")} Toda movimentação pede confirmação e registra histórico. Responsáveis são designados nos detalhes do projeto.</div><div class="kanban">${[
    { id: null, name: "Sem alocação", status: "Disponível" },
    ...allProjects,
  ]
    .map((p) => {
      const es = state.employees.filter(
        (e) => e.projectId === p.id && matches(e),
      );
      const a = alerts(state).filter((a) => a.projectId === p.id);
      return `<section class="kanban-column ${p.id ? "" : "unassigned"}" data-drop="${esc(p.id || "")}"><header><span class="dot ${p.id ? "" : "amber-dot"}"></span><h3>${esc(p.name)}</h3><b>${es.length}</b></header><p class="column-sub">${p.id ? esc(p.city) + " · " + esc(p.uf) : "Prontos para o próximo projeto"}</p>${a.some((a) => a.type === "owner") ? '<div class="column-alert">⚠ Sem responsável designado</div>' : ""}<div class="cards">${es.map((e) => `<article class="employee-card" draggable="true" data-employee="${esc(e.id)}"><span class="grip">⠿</span><div class="person-line">${avatar(e)}<div><b>${esc(e.name)}</b><small>${esc(e.role)}</small></div></div><div class="card-bottom"><span>${p.responsibles?.includes(e.id) ? '<span class="owner-tag">Responsável</span>' : esc(e.code)}</span>${button("Mover ↗", "move", e.id, "text-button")}</div></article>`).join("")}<div class="drop-hint">Solte um funcionário aqui</div></div>${p.id ? button("Detalhes do projeto →", "project-detail", p.id, "text-button full") : ""}</section>`;
    })
    .join("")}</div>`;
}
function projectsPage(ps) {
  return `<div class="section-title"><div><h2>Portfólio de projetos <span class="count-tag">${ps.length}</span></h2><p>Configure campos adicionais em cada projeto.</p></div></div>${projectTable(ps)}`;
}
function employeesPage(ps) {
  const allowed = new Set(ps.map((p) => p.id));
  const employees = state.employees.filter(
    (e) =>
      (!query ||
        [
          e.name,
          e.code,
          e.role,
          e.department,
          state.projects.find((p) => p.id === e.projectId)?.name || "",
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR"))) &&
      ((!statusFilter && !ufFilter) || allowed.has(e.projectId)) &&
      (!departmentFilter || e.department === departmentFilter),
  );
  const groups = employeeDepartments
    .map((department) => ({
      department,
      employees: employees.filter((e) => e.department === department),
    }))
    .filter((group) => group.employees.length);
  const cards = (es) =>
    `<div class="employee-grid">${es
      .map((e) => {
        const p = state.projects.find((p) => p.id === e.projectId);
        return `<article class="panel person-panel"><div class="person-line">${avatar(e)}<div><h3>${esc(e.name)}</h3><p>${esc(e.role)}</p></div></div><span class="department-tag">${esc(e.department || legacyDepartment)}</span><p class="employee-code">Matrícula ${e.code ? esc(e.code) : "não informada"}</p><div class="allocation-label">${icon("project")} ${esc(p?.name || "Sem alocação")}</div>${p?.responsibles.includes(e.id) ? '<span class="owner-tag">Responsável designado</span>' : ""}<div class="person-actions">${button("Editar", "employee-edit", e.id)}${button("Mover " + icon("arrow"), "move", e.id, "text-button")}</div></article>`;
      })
      .join("")}</div>`;
  return `<div class="section-title"><h2>${employees.length} funcionários</h2><span class="muted">${state.employees.filter((e) => !e.projectId).length} sem alocação</span></div><label class="department-filter">Departamento<select id="department-filter"><option value="">Todos os departamentos</option>${employeeDepartments.map((department) => `<option value="${esc(department)}" ${department === departmentFilter ? "selected" : ""}>${esc(department)}</option>`).join("")}</select></label><p class="small-text">CSV: Nome e Departamento ou Setor são obrigatórios. Se Função não vier preenchida, será igual ao Departamento; Matrícula é opcional. Importados ficam sem alocação.</p>${groups.map((group) => `<section class="department-group"><div class="section-title"><h2>${esc(group.department)}</h2><span class="muted">${group.employees.length} funcionários</span></div>${cards(group.employees)}</section>`).join("") || empty("Nenhum funcionário encontrado.")}`;
}
function alertCard(a) {
  const p = state.projects.find((p) => p.id === a.projectId);
  return `<button class="alert-card ${a.critical ? "critical" : "upcoming"}" data-action="project-detail" data-id="${esc(p.id)}"><span class="alert-symbol">${icon(a.critical ? "alert" : "clock")}</span><div><b>${esc(a.text)}</b><small>${esc(p.name)} · ${esc(p.city)} / ${esc(p.uf)}</small></div>${icon("arrow")}</button>`;
}
function alertsPage(ps) {
  const ids = new Set(ps.map((p) => p.id)),
    a = alerts(state).filter((a) => ids.has(a.projectId));
  return `<div class="alert-summary"><h2>${a.length} alertas na sua operação</h2><p>Prazo próximo: até ${state.settings.warningDays} dias. Projetos concluídos não geram alertas.</p></div><section class="panel alert-panel">${
    a
      .sort((a, b) => b.critical - a.critical)
      .map(alertCard)
      .join("") ||
    '<div class="empty">✓ Todos os projetos selecionados estão sem alertas.</div>'
  }</section>`;
}
function historyPage() {
  return `<section class="panel"><div class="panel-heading"><div><h2>Atividade registrada</h2><p>${state.history.length} eventos • datas no fuso de São Paulo</p></div></div><div class="table-wrap"><table><thead><tr><th>QUANDO</th><th>AÇÃO / PESSOA</th><th>ORIGEM</th><th>DESTINO</th></tr></thead><tbody>${state.history.map((h) => `<tr><td>${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(h.at))}</td><td><b>${esc(h.employee)}</b><small>${esc(h.action)}</small></td><td>${esc(h.from)}</td><td>${esc(h.to)}</td></tr>`).join("") || '<tr><td colspan="4">Nenhuma atividade registrada.</td></tr>'}</tbody></table></div></section>`;
}
function settingsPage() {
  return `<div class="settings-grid"><section class="panel settings-panel"><span class="soft-icon">${icon("alert")}</span><h2>Regras de acompanhamento</h2><p>Alertas são recalculados a cada abertura e alteração. Obras ativas precisam de ao menos um responsável que faça parte da equipe.</p><form id="settings-form"><label>Antecedência do alerta de conclusão (dias)<input type="number" name="warningDays" min="1" max="180" required value="${state.settings.warningDays}"></label><button class="primary" type="submit">Salvar configuração</button></form></section><section class="panel settings-panel"><span class="soft-icon">${icon("download")}</span><h2>Backup e portabilidade</h2><p>${mode === "server" ? "Os dados ficam no arquivo SQLite do servidor local." : "Os dados ficam somente neste navegador e nesta origem. Limpar os dados do site apaga a base."} Exporte um backup antes de trocar a base.</p><div class="settings-actions">${button("Exportar backup JSON", "export", "", "primary")}<label class="secondary file-button">Importar backup<input type="file" id="import-file" accept=".json,application/json" hidden></label></div><p class="small-text">Importar substitui todos os projetos, funcionários e histórico após validação e confirmação.</p></section><section class="panel settings-panel"><h2>Começar com dados reais</h2><p>Exporte a demonstração como referência. Depois, crie uma base vazia e cadastre suas obras e funcionários. Use apenas os dados necessários à gestão.</p>${button("Criar base vazia", "empty-base", "", "danger-button")}</section><section class="panel settings-panel"><h2>Sobre este MVP</h2><p>16 projetos e 48 funcionários fictícios na demonstração. Coordenadas indicam obras, nunca a posição de pessoas.</p><p>${mode === "server" ? "Servidor local restrito a este computador, com controle de versão para evitar sobrescrita entre abas." : "Versão estática para uso individual. A versão executável com servidor e SQLite acompanha o projeto."} Para operação em rede, adicione autenticação e controle de acesso conforme o README.</p></section></div>`;
}
function openDialog(content, wide = false) {
  const d = $("#modal");
  d.innerHTML = `<div class="modal-inner ${wide ? "wide" : ""}"><button class="modal-close" data-action="close" aria-label="Fechar">×</button>${content}</div>`;
  if (!d.open) d.showModal();
  d.scrollTop = 0;
  setTimeout(() => d.querySelector("input,select,button")?.focus(), 20);
}
function closeDialog() {
  $("#modal").close();
}
function confirmDialog(title, description, onConfirm, label = "Confirmar") {
  openDialog(
    `<span class="soft-icon">${icon("alert")}</span><h2>${esc(title)}</h2><div class="confirm-description">${description}</div><div class="modal-actions">${button("Cancelar", "close")}<button class="primary" id="confirm-action">${esc(label)}</button></div>`,
  );
  $("#confirm-action").onclick = async () => {
    if ((await onConfirm()) !== false) closeDialog();
  };
}
function event(next, action, name, from = "—", to = "—") {
  next.history.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    employee: name,
    from,
    to,
    action,
  });
}
function detail(id) {
  const p = state.projects.find((p) => p.id === id);
  if (!p) return;
  const t = team(state, id),
    a = alerts(state).filter((a) => a.projectId === id),
    d = days(today(), p.end);
  openDialog(
    `<div class="eyebrow">PROJETO · ${esc(p.uf)}</div><h2>${esc(p.name)}</h2><p>${esc(p.city)} / ${esc(p.uf)} · ${p.lat}, ${p.lng}</p>${badge(p)}<div class="detail-stats"><div><small>Progresso físico</small><strong>${p.progress}%</strong></div><div><small>Tempo total previsto</small><strong>${days(p.start, p.end)} dias</strong></div><div><small>${p.status === "Concluída" ? "Situação" : d < 0 ? "Atraso" : "Tempo restante"}</small><strong>${p.status === "Concluída" ? "Concluída" : Math.abs(d) + " dias"}</strong></div></div><div class="progress"><i style="width:${p.progress}%"></i></div><p>${fmt(p.start)} → ${fmt(p.end)}</p>${a.map((x) => `<div class="inline-warning">${esc(x.text)}</div>`).join("")}<h3>Equipe e responsáveis <span class="count-tag">${t.length}</span></h3><div class="detail-team">${t.map((e) => `<div class="detail-person">${avatar(e)}<div><b>${esc(e.name)}</b><small>${esc(e.role)}${p.responsibles.includes(e.id) ? " · Responsável" : ""}</small></div>${button("Mover", "move", e.id, "text-button")}</div>`).join("") || "<p>Nenhum funcionário alocado.</p>"}</div><h3>Metas e entregas</h3><p class="preserve">${esc(p.goals) || "Nenhuma meta registrada."}</p><h3>Campos do projeto</h3><dl>${
      Object.entries(p.fields)
        .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
        .join("") || "<p>Nenhum campo adicional.</p>"
    }</dl><div class="modal-actions">${button("Registrar medição", "record-measurement", id)}${button("Excluir projeto", "project-delete", id, "danger-button")}${button("Editar projeto", "project-edit", id, "primary")}</div>`,
    true,
  );
}
const field = (label, name, value, type = "text", extra = "") =>
  `<label>${label}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;
function projectForm(id) {
  const p = state.projects.find((p) => p.id === id) || {
    name: "",
    city: "",
    uf: "SP",
    lat: -23.55,
    lng: -46.63,
    start: today(),
    end: today(),
    status: "Planejada",
    progress: 0,
    responsibles: [],
    goals: "",
    fields: {},
  };
  openDialog(
    `<div class="eyebrow">CADASTRO DE OBRA</div><h2>${id ? "Editar projeto" : "Novo projeto"}</h2><p>Defina a localização, os prazos e os responsáveis pela entrega.</p><form id="project-form"><div class="form-grid"><label class="span2">Nome do projeto<input name="name" required maxlength="200" value="${esc(p.name)}"></label>${field("Cidade", "city", p.city, "text", 'required maxlength="200"')}<label>UF<select name="uf">${"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
      .split(" ")
      .map((uf) => `<option ${uf === p.uf ? "selected" : ""}>${uf}</option>`)
      .join(
        "",
      )}</select></label>${field("Latitude da obra", "lat", p.lat, "number", 'required step="any" min="-34" max="6"')}${field("Longitude da obra", "lng", p.lng, "number", 'required step="any" min="-74" max="-28"')}${field("Data de início", "start", p.start, "date", "required")}${field("Conclusão prevista", "end", p.end, "date", "required")}<label>Status<select name="status">${statuses.map((s) => `<option ${s === p.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>${field("Progresso físico (%)", "progress", p.progress, "number", 'required min="0" max="100" step="1"')}<fieldset class="span2"><legend>Responsáveis designados</legend><p class="small-text">Aloque as pessoas no quadro antes de designá-las. Pode haver mais de um responsável.</p>${
      team(state, id)
        .map(
          (e) =>
            `<label class="check-label"><input type="checkbox" name="responsibles" value="${esc(e.id)}" ${p.responsibles.includes(e.id) ? "checked" : ""}>${esc(e.name)} · ${esc(e.role)}</label>`,
        )
        .join("") ||
      "<small>Sem funcionários neste projeto. Salve e aloque sua equipe.</small>"
    }</fieldset><label class="span2">Metas e entregas<textarea name="goals" rows="3" maxlength="5000">${esc(p.goals)}</textarea></label><div class="span2"><h3>Campos adicionais</h3><p class="small-text">Configure informações como cliente, contrato, fase ou orçamento.</p><div id="custom-fields">${Object.entries(
      p.fields,
    )
      .map(([k, v]) => customRow(k, v))
      .join(
        "",
      )}</div>${button("+ Adicionar campo", "field-add", "", "text-button")}</div></div><div id="form-error" role="alert"></div><div class="modal-actions">${button("Cancelar", "close")}<button class="primary" type="submit">Salvar projeto</button></div></form>`,
    true,
  );
  $("#project-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      next = structuredClone(state);
    try {
      const fields = {};
      for (const row of document.querySelectorAll(".custom-field")) {
        const k = row.querySelector("[data-field-key]").value.trim(),
          v = row.querySelector("[data-field-value]").value.trim();
        if (!k) throw Error("Informe o nome de cada campo adicional.");
        if (Object.hasOwn(fields, k))
          throw Error("Nomes de campos adicionais devem ser únicos.");
        Object.defineProperty(fields, k, {
          value: v,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      const data = {
        id: id || crypto.randomUUID(),
        name: f.get("name").trim(),
        city: f.get("city").trim(),
        uf: f.get("uf"),
        lat: Number(f.get("lat")),
        lng: Number(f.get("lng")),
        start: f.get("start"),
        end: f.get("end"),
        status: f.get("status"),
        progress: Number(f.get("progress")),
        responsibles: f.getAll("responsibles"),
        goals: f.get("goals").trim(),
        fields,
      };
      if (id) next.projects[next.projects.findIndex((p) => p.id === id)] = data;
      else next.projects.push(data);
      event(next, id ? "Projeto atualizado" : "Projeto criado", data.name);
      validate(next);
      if (await persist(next, "Projeto salvo.")) closeDialog();
    } catch (err) {
      $("#form-error").textContent = err.message;
    }
  };
}
function projectFormConfigured(id) {
  const current = state.projects.find((project) => project.id === id),
    defaultEnd = new Date(Date.parse(today() + "T12:00:00Z") + 30 * 86400000)
      .toISOString()
      .slice(0, 10),
    p = current || {
      name: "",
      city: "",
      uf: "SP",
      lat: -23.55,
      lng: -46.63,
      start: today(),
      end: defaultEnd,
      status: "Planejada",
      progress: 0,
      responsibles: [],
      goals: "",
      fields: {},
      departmentMinimums: Object.fromEntries(
        departments.map((department) => [department, 0]),
      ),
    };
  const minimumFields = departments
    .map(
      (department, index) =>
        `<label>Mínimo · ${esc(department)}<input type="number" name="minimum${index}" min="0" max="10000" step="1" required value="${p.departmentMinimums[department] ?? 0}"></label>`,
    )
    .join("");
  openDialog(
    `<div class="eyebrow">CADASTRO DE OBRA</div><h2>${id ? "Editar projeto" : "Novo projeto"}</h2><p>Defina localização, prazos, responsáveis e a equipe mínima por departamento.</p><form id="project-form"><div class="form-grid"><label class="span2">Nome do projeto<input name="name" required maxlength="200" value="${esc(p.name)}"></label>${field("Cidade", "city", p.city, "text", 'required maxlength="200"')}<label>UF<select name="uf">${"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
      .split(" ")
      .map((uf) => `<option ${uf === p.uf ? "selected" : ""}>${uf}</option>`)
      .join(
        "",
      )}</select></label>${field("Latitude da obra", "lat", p.lat, "number", 'required step="any" min="-34" max="6"')}${field("Longitude da obra", "lng", p.lng, "number", 'required step="any" min="-74" max="-28"')}${field("Data de início", "start", p.start, "date", "required")}${field("Conclusão prevista", "end", p.end, "date", "required")}<label>Status<select name="status">${statuses.map((status) => `<option ${status === p.status ? "selected" : ""}>${status}</option>`).join("")}</select></label><label>Progresso automático<input id="progress-preview" value="${projectProgress(p)}%" readonly><small class="small-text">Calculado pelo tempo entre início e conclusão prevista.</small></label><div class="span2"><h3>Equipe mínima por departamento</h3><p class="small-text">Alertas serão gerados quando a equipe alocada ficar abaixo destes mínimos. Use 0 para não exigir funcionários.</p><div class="form-grid">${minimumFields}</div></div><fieldset class="span2"><legend>Responsáveis designados</legend><p class="small-text">Aloque as pessoas no quadro antes de designá-las. Pode haver mais de um responsável.</p>${
      team(state, id)
        .map(
          (employee) =>
            `<label class="check-label"><input type="checkbox" name="responsibles" value="${esc(employee.id)}" ${p.responsibles.includes(employee.id) ? "checked" : ""}>${esc(employee.name)} · ${esc(employee.role)}</label>`,
        )
        .join("") ||
      "<small>Sem funcionários neste projeto. Salve e aloque sua equipe.</small>"
    }</fieldset><label class="span2">Metas e entregas<textarea name="goals" rows="3" maxlength="5000">${esc(p.goals)}</textarea></label><div class="span2"><h3>Campos adicionais</h3><p class="small-text">Configure informações como cliente, contrato, fase ou orçamento.</p><div id="custom-fields">${Object.entries(
      p.fields,
    )
      .map(([key, value]) => customRow(key, value))
      .join(
        "",
      )}</div>${button("+ Adicionar campo", "field-add", "", "text-button")}</div></div><div id="form-error" role="alert"></div><div class="modal-actions">${button("Cancelar", "close")}<button class="primary" type="submit">Salvar projeto</button></div></form>`,
    true,
  );
  const form = $("#project-form");
  const updateProgress = () => {
    $("#progress-preview").value =
      `${projectProgress({ start: form.elements.start.value, end: form.elements.end.value, status: form.elements.status.value })}%`;
  };
  form.addEventListener("change", updateProgress);
  form.onsubmit = async (eventObject) => {
    eventObject.preventDefault();
    const formData = new FormData(form),
      next = structuredClone(state);
    try {
      const fields = {};
      for (const row of document.querySelectorAll(".custom-field")) {
        const key = row.querySelector("[data-field-key]").value.trim(),
          value = row.querySelector("[data-field-value]").value.trim();
        if (!key) throw Error("Informe o nome de cada campo adicional.");
        if (Object.hasOwn(fields, key))
          throw Error("Nomes de campos adicionais devem ser únicos.");
        Object.defineProperty(fields, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      const departmentMinimums = Object.fromEntries(
        departments.map((department, index) => [
          department,
          Number(formData.get(`minimum${index}`)),
        ]),
      );
      const data = {
        id: id || crypto.randomUUID(),
        name: formData.get("name").trim(),
        city: formData.get("city").trim(),
        uf: formData.get("uf"),
        lat: Number(formData.get("lat")),
        lng: Number(formData.get("lng")),
        start: formData.get("start"),
        end: formData.get("end"),
        status: formData.get("status"),
        progress: projectProgress({
          start: formData.get("start"),
          end: formData.get("end"),
          status: formData.get("status"),
        }),
        departmentMinimums,
        responsibles: formData.getAll("responsibles"),
        goals: formData.get("goals").trim(),
        fields,
      };
      if (id)
        next.projects[next.projects.findIndex((project) => project.id === id)] =
          data;
      else next.projects.push(data);
      event(next, id ? "Projeto atualizado" : "Projeto criado", data.name);
      validate(next);
      if (await persist(next, "Projeto salvo.")) closeDialog();
    } catch (error) {
      $("#form-error").textContent = error.message;
    }
  };
}
function customRow(k = "", v = "") {
  return `<div class="custom-field"><input data-field-key placeholder="Nome do campo" aria-label="Nome do campo adicional" maxlength="200" value="${esc(k)}" required><input data-field-value placeholder="Valor" aria-label="Valor do campo adicional" maxlength="1000" value="${esc(v)}"><button type="button" data-action="field-remove" aria-label="Remover campo">×</button></div>`;
}
function employeeForm(id) {
  const e = state.employees.find((e) => e.id === id) || {
    name: "",
    role: "",
    code: "",
    department: departments[0],
    color: "#275d70",
  };
  openDialog(
    `<div class="eyebrow">CADASTRO DE PESSOA</div><h2>${id ? "Editar funcionário" : "Novo funcionário"}</h2><form id="employee-form">${field("Nome de exibição", "name", e.name, "text", 'required maxlength="200"')}<label>Departamento<select name="department" required aria-label="Departamento do funcionário">${employeeDepartments.map((department) => `<option value="${esc(department)}" ${department === e.department ? "selected" : ""}>${esc(department)}</option>`).join("")}</select></label>${field("Função", "role", e.role, "text", 'required maxlength="200"')}${field("Matrícula (opcional)", "code", e.code || "", "text", 'maxlength="200"')}<p class="small-text">Selecione o departamento. A matrícula é opcional e, se informada, deve ser única. A alocação é feita pelo quadro ou pelo botão Mover.</p><div id="form-error" role="alert"></div><div class="modal-actions">${id ? button("Excluir", "employee-delete", id, "danger-button") : button("Cancelar", "close")}<button class="primary" type="submit">Salvar funcionário</button></div></form>`,
  );
  $("#employee-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target),
      next = structuredClone(state),
      data = {
        ...e,
        id: id || crypto.randomUUID(),
        name: f.get("name").trim(),
        role: f.get("role").trim(),
        code: f.get("code").trim(),
        department: f.get("department"),
        projectId: e.projectId || null,
      };
    if (id) next.employees[next.employees.findIndex((x) => x.id === id)] = data;
    else next.employees.push(data);
    event(
      next,
      id ? "Funcionário atualizado" : "Funcionário criado",
      data.name,
    );
    try {
      validate(next);
      if (await persist(next, "Funcionário salvo.")) closeDialog();
    } catch (err) {
      $("#form-error").textContent = err.message;
    }
  };
}
function requestMove(id, target = undefined) {
  const e = state.employees.find((e) => e.id === id);
  if (!e) return;
  if (target === undefined) {
    openDialog(
      `<h2>Realocar funcionário</h2><p>${esc(e.name)} · ${esc(e.role)}</p><form id="move-form"><label>Projeto de destino<select name="target"><option value="">Sem alocação</option>${state.projects
        .filter((p) => p.status !== "Concluída")
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${p.id === e.projectId ? "selected" : ""}>${esc(p.name)} · ${esc(p.uf)}</option>`,
        )
        .join(
          "",
        )}</select></label><div class="modal-actions">${button("Cancelar", "close")}<button class="primary" type="submit">Continuar →</button></div></form>`,
    );
    $("#move-form").onsubmit = (ev) => {
      ev.preventDefault();
      requestMove(id, new FormData(ev.target).get("target") || null);
    };
    return;
  }
  if (e.projectId === target) {
    toast("O funcionário já está nesta alocação.");
    return;
  }
  try {
    const next = transfer(state, id, target),
      source = state.projects.find((p) => p.id === e.projectId),
      dest = state.projects.find((p) => p.id === target),
      newAlerts = alerts(next).filter(
        (a) =>
          a.projectId === source?.id &&
          !alerts(state).some((x) => x.id === a.id),
      );
    confirmDialog(
      "Confirmar movimentação",
      `<div class="move-person">${avatar(e)}<b>${esc(e.name)}</b></div><div class="move-route"><span>${esc(source?.name || "Sem alocação")}</span>${icon("arrow")}<span>${esc(dest?.name || "Sem alocação")}</span></div>${source?.responsibles.includes(id) ? '<div class="inline-warning">A designação como responsável na origem será removida. Designe um responsável no destino, se necessário.</div>' : ""}${newAlerts.map((a) => `<div class="inline-warning">⚠ ${esc(source.name)}: ${esc(a.text)}. Confirme ciente deste alerta.</div>`).join("")}<p>A movimentação será salva no histórico.</p>`,
      () => persist(next, "Movimentação registrada."),
      "Confirmar transferência",
    );
  } catch (e) {
    toast(e.message, true);
  }
}
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `workload-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Backup exportado.");
}
async function importEmployeeCsv(file) {
  try {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024)
      throw Error("O arquivo CSV deve ter até 5 MB.");
    const records = parseEmployeeCsv(await file.text()),
      next = structuredClone(state),
      existingCodes = new Set(
        next.employees
          .map((e) => (e.code || "").trim().toLocaleLowerCase("pt-BR"))
          .filter(Boolean),
      );
    for (const employee of records) {
      const code = employee.code.toLocaleLowerCase("pt-BR");
      if (code && existingCodes.has(code))
        throw Error(`A matrícula "${employee.code}" já existe na base.`);
      if (code) existingCodes.add(code);
      next.employees.push({
        ...employee,
        id: crypto.randomUUID(),
        projectId: null,
        color: "#275d70",
      });
    }
    event(
      next,
      "Funcionários importados",
      `${records.length} funcionários`,
      file.name,
      "Cadastro de funcionários",
    );
    validate(next);
    confirmDialog(
      "Importar funcionários?",
      `<p>Serão adicionados <b>${records.length} funcionários</b> à base atual. Os registros ficarão sem alocação; nenhuma informação existente será substituída.</p><p>Se o CSV não tiver Função, o setor será usado como função. Matrículas podem ficar vazias.</p>`,
      () => persist(next, `${records.length} funcionários importados.`),
      "Importar funcionários",
    );
  } catch (e) {
    toast("Não foi possível importar o CSV: " + e.message, true);
  }
}
async function importData(file) {
  try {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) throw Error("O backup deve ter até 5 MB.");
    const next = validate(migrate(JSON.parse(await file.text())));
    confirmDialog(
      "Substituir a base atual?",
      `<p>Serão importados <b>${next.projects.length} projetos</b> e <b>${next.employees.length} funcionários</b>. Toda a base atual será substituída.</p><p>Exporte um backup antes de confirmar esta operação.</p>`,
      () => persist(next, "Backup importado."),
      "Substituir base",
    );
  } catch (e) {
    toast("Não foi possível importar: " + e.message, true);
  }
}
const actions = {
  nav: (id) => {
    page = id;
    render();
    window.scrollTo(0, 0);
  },
  close: closeDialog,
  clear: () => {
    query = "";
    statusFilter = "";
    ufFilter = "";
    render();
  },
  "project-detail": detail,
  "project-new": () => projectForm(),
  "project-edit": projectForm,
  "employee-new": () => employeeForm(),
  "employee-edit": employeeForm,
  move: (id) => requestMove(id),
  "record-measurement": (id) => measurementForm(id),
  export: exportData,
  "field-add": () =>
    $("#custom-fields").insertAdjacentHTML("beforeend", customRow()),
  "field-remove": (_, el) => el.closest(".custom-field").remove(),
  "map-fit": () => {
    const ps = selected();
    if (ps.length && map)
      map.fitBounds(
        ps.map((p) => [p.lat, p.lng]),
        { padding: [40, 40], maxZoom: 6 },
      );
  },
  "map-select": (id) => {
    const p = state.projects.find((p) => p.id === id);
    if (map && markers[id]) {
      map.setView([p.lat, p.lng], 7);
      markers[id].openPopup();
    }
  },
  "project-delete": (id) => {
    const p = state.projects.find((p) => p.id === id);
    confirmDialog(
      "Excluir projeto?",
      `<p><b>${esc(p.name)}</b> será excluído. ${team(state, id).length} funcionários passarão para “Sem alocação”. O histórico será preservado.</p>`,
      () => {
        const next = structuredClone(state);
        for (const e of next.employees.filter((e) => e.projectId === id)) {
          event(
            next,
            "Desalocação por exclusão de projeto",
            e.name,
            p.name,
            "Sem alocação",
          );
          e.projectId = null;
        }
        next.measurements = (next.measurements || []).filter(
          (measurement) => measurement.projectId !== id,
        );
        next.projects = next.projects.filter((p) => p.id !== id);
        event(next, "Projeto excluído", p.name);
        return persist(next, "Projeto excluído.");
      },
      "Excluir projeto",
    );
  },
  "employee-delete": (id) => {
    const e = state.employees.find((e) => e.id === id),
      p = state.projects.find((p) => p.id === e.projectId);
    confirmDialog(
      "Excluir funcionário?",
      `<p>${esc(e.name)} será removido dos cadastros e dos responsáveis. O histórico será preservado.</p>${p?.responsibles.includes(id) ? '<div class="inline-warning">Esta pessoa é responsável por uma obra. A exclusão pode deixar o projeto sem responsável.</div>' : ""}`,
      () => {
        const next = structuredClone(state);
        next.employees = next.employees.filter((e) => e.id !== id);
        next.projects.forEach(
          (p) => (p.responsibles = p.responsibles.filter((x) => x !== id)),
        );
        event(next, "Funcionário excluído", e.name, p?.name || "Sem alocação");
        return persist(next, "Funcionário excluído.");
      },
      "Excluir funcionário",
    );
  },
  "empty-base": () =>
    confirmDialog(
      "Criar base vazia?",
      `<p>Projetos, funcionários e histórico atuais serão removidos. Exporte seu backup antes de continuar.</p>`,
      () =>
        persist(
          {
            version: 1,
            projects: [],
            employees: [],
            measurements: [],
            history: [],
            settings: { ...state.settings },
          },
          "Base vazia criada.",
        ),
      "Criar base vazia",
    ),
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || saving) return;
  e.preventDefault();
  actions[b.dataset.action]?.(b.dataset.id, b);
});
document.addEventListener("dragstart", (e) => {
  const card = e.target.closest("[data-employee]");
  if (card) {
    dragId = card.dataset.employee;
    e.dataTransfer.setData("text/plain", dragId);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  }
});
document.addEventListener("dragend", () => {
  dragId = null;
  document
    .querySelectorAll(".dragging,.drag-over")
    .forEach((el) => el.classList.remove("dragging", "drag-over"));
});
document.addEventListener("dragover", (e) => {
  const col = e.target.closest("[data-drop]");
  if (col && dragId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    document
      .querySelectorAll(".drag-over")
      .forEach((x) => x.classList.remove("drag-over"));
    col.classList.add("drag-over");
  }
});
document.addEventListener("drop", (e) => {
  const col = e.target.closest("[data-drop]");
  if (col && dragId) {
    e.preventDefault();
    requestMove(dragId, col.dataset.drop || null);
    col.classList.remove("drag-over");
  }
});
function wire() {
  if (page === "employees")
    document
      .querySelector(".heading-actions")
      .insertAdjacentHTML(
        "afterbegin",
        '<a class="secondary" href="./modelo-funcionarios.csv" download="modelo-funcionarios.csv">Baixar modelo CSV</a><label class="secondary file-button">Importar CSV<input type="file" id="employee-csv-file" accept=".csv,text/csv" hidden></label>',
      );
  if ($("#search"))
    $("#search").oninput = (e) => {
      query = e.target.value;
      const pos = e.target.selectionStart;
      clearTimeout(wire.timer);
      wire.timer = setTimeout(() => {
        render();
        $("#search").focus();
        $("#search").setSelectionRange(pos, pos);
      }, 250);
    };
  if ($("#status-filter"))
    $("#status-filter").onchange = (e) => {
      statusFilter = e.target.value;
      render();
    };
  if ($("#uf-filter"))
    $("#uf-filter").onchange = (e) => {
      ufFilter = e.target.value;
      render();
    };
  if ($("#department-filter"))
    $("#department-filter").onchange = (e) => {
      departmentFilter = e.target.value;
      render();
    };
  if ($("#settings-form"))
    $("#settings-form").onsubmit = (e) => {
      e.preventDefault();
      const next = structuredClone(state);
      next.settings.warningDays = Number(
        new FormData(e.target).get("warningDays"),
      );
      persist(next, "Configuração salva.");
    };
  if ($("#import-file"))
    $("#import-file").onchange = (e) => importData(e.target.files[0]);
  if ($("#employee-csv-file"))
    $("#employee-csv-file").onchange = (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      importEmployeeCsv(file);
    };
}
actions["project-new"] = () => projectFormConfigured();
actions["project-edit"] = projectFormConfigured;
const wireWithProjectActionPolicy = wire;
wire = function () {
  wireWithProjectActionPolicy();
  if (page !== "projects")
    document
      .querySelectorAll('.heading-actions [data-action="project-new"]')
      .forEach((action) => action.remove());
  if (page !== "employees")
    document
      .querySelectorAll('.heading-actions [data-action="employee-new"]')
      .forEach((action) => action.remove());
};
let scheduleMonth = today().slice(0, 7);
nav.push(["schedule", "clock", "Cronograma"]);
titles.schedule = [
  "Cronograma de alocação",
  "Visualize os períodos dos projetos e suas equipes por dia.",
];
function schedulePage() {
  const [year, month] = scheduleMonth.split("-").map(Number),
    daysInMonth = new Date(year, month, 0).getDate(),
    monthStart = `${scheduleMonth}-01`,
    monthEnd = `${scheduleMonth}-${String(daysInMonth).padStart(2, "0")}`,
    queryText = query.toLocaleLowerCase("pt-BR");
  const matches = (e) =>
    !queryText ||
    [e.name, e.role, e.code, e.department]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(queryText);
  const departmentMatches = (e) =>
    !departmentFilter || e.department === departmentFilter;
  const dayHeaders = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1,
      date = `${scheduleMonth}-${String(day).padStart(2, "0")}`,
      weekday = new Intl.DateTimeFormat("pt-BR", {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`));
    return `<span class="schedule-day ${date === today() ? "today" : ""}" title="${weekday}">${String(day).padStart(2, "0")}</span>`;
  }).join("");
  const rowsFor = (project, employees) =>
    employees
      .map((e) => {
        const overlaps =
          project && project.start <= monthEnd && project.end >= monthStart;
        const startDay = overlaps
            ? project.start < monthStart
              ? 1
              : Number(project.start.slice(-2))
            : 0,
          endDay = overlaps
            ? project.end > monthEnd
              ? daysInMonth
              : Number(project.end.slice(-2))
            : 0;
        const bar = overlaps
          ? `<span class="schedule-bar ${project.status === "Ativa" ? "active" : project.status === "Concluída" ? "complete" : project.status === "Pausada" ? "paused" : "planned"}" style="grid-column:${startDay}/${endDay + 1}" title="${esc(project.name)} · ${fmt(project.start)} a ${fmt(project.end)}">${esc(project.name)}</span>`
          : '<span class="schedule-outside">Sem atividade neste mês</span>';
        const todayCell =
          scheduleMonth === today().slice(0, 7)
            ? `<span class="schedule-today-cell" style="left:${(Number(today().slice(-2)) - 1) * 34}px"></span>`
            : "";
        return `<div class="schedule-row"><div class="schedule-person"><span class="schedule-avatar">${esc(initials(e.name))}</span><div><b>${esc(e.name)}</b><small>${esc(e.role)} · ${esc(e.department || legacyDepartment)}</small></div></div><div class="schedule-track">${todayCell}${bar}</div></div>`;
      })
      .join("");
  const projects = state.projects.filter(
    (p) =>
      (!statusFilter || p.status === statusFilter) &&
      (!ufFilter || p.uf === ufFilter) &&
      (!queryText ||
        [
          p.name,
          p.city,
          p.uf,
          ...team(state, p.id).flatMap((e) => [
            e.name,
            e.role,
            e.code,
            e.department,
          ]),
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(queryText)),
  );
  const groups = projects
    .map((p) => {
      const employees = team(state, p.id).filter(
        (e) => matches(e) && departmentMatches(e),
      );
      return { project: p, employees };
    })
    .filter((group) => group.employees.length);
  const unallocated =
    !statusFilter && !ufFilter
      ? state.employees.filter(
          (e) => !e.projectId && matches(e) && departmentMatches(e),
        )
      : [];
  const groupHtml = groups
    .map(
      ({ project, employees }) =>
        `<div class="schedule-group"><div><span class="schedule-group-dot ${project.status === "Concluída" ? "complete" : project.status === "Pausada" ? "paused" : project.status === "Planejada" ? "planned" : ""}"></span><b>${esc(project.name)}</b><small>${esc(project.city)} · ${esc(project.uf)} · ${employees.length} ${employees.length === 1 ? "funcionário" : "funcionários"}</small></div>${badge(project)}</div>${rowsFor(project, employees)}`,
    )
    .join("");
  return `<section class="panel schedule-panel"><div class="schedule-toolbar"><div><h2>Equipe por projeto</h2><p>Período planejado de cada projeto, detalhado por funcionário.</p></div><div class="schedule-controls"><label>Departamento<select id="schedule-department"><option value="">Todos os departamentos</option>${employeeDepartments.map((department) => `<option value="${esc(department)}" ${department === departmentFilter ? "selected" : ""}>${esc(department)}</option>`).join("")}</select></label><label>Mês<input id="schedule-month" type="month" value="${esc(scheduleMonth)}"></label></div></div><div class="schedule-legend"><span><i class="active"></i>Ativa</span><span><i class="planned"></i>Planejada</span><span><i class="paused"></i>Pausada</span><span><i class="complete"></i>Concluída</span></div><div class="schedule-scroll"><div class="schedule-timeline"><div class="schedule-header"><b>COLABORADOR</b><div class="schedule-track schedule-days">${dayHeaders}</div></div>${groupHtml}${unallocated.length ? `<div class="schedule-group available"><div><span class="schedule-group-dot planned"></span><b>Sem alocação</b><small>${unallocated.length} ${unallocated.length === 1 ? "funcionário disponível" : "funcionários disponíveis"}</small></div></div>${rowsFor(null, unallocated)}` : ""}${!groups.length && !unallocated.length ? '<div class="empty">Nenhum funcionário encontrado para os filtros atuais.</div>' : ""}</div></div><p class="schedule-note">As barras representam as datas de início e conclusão previstas do projeto; não indicam períodos individuais de trabalho.</p></section>`;
}
function latestMeasurement(projectId, date = today()) {
  return (
    (state.measurements || [])
      .filter(
        (measurement) =>
          measurement.projectId === projectId && measurement.date <= date,
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null
  );
}
function plannedProgressAt(project, date) {
  const duration = days(project.start, project.end);
  if (duration <= 0) return date < project.start ? 0 : 100;
  return Math.round(
    Math.max(0, Math.min(1, days(project.start, date) / duration)) * 100,
  );
}
function measurementForm(projectId = "") {
  const eligibleProjects = state.projects.filter(
    (project) => project.start <= today(),
  );
  if (!eligibleProjects.length) {
    toast("Só é possível registrar medição a partir da data de início do projeto.", true);
    return;
  }
  const defaultProject =
    eligibleProjects.find((project) => project.id === projectId) ||
    eligibleProjects[0];
  openDialog(
    `<div class="eyebrow">AVANÇO FÍSICO</div><h2>Registrar medição</h2><p>Informe o avanço físico real apurado na data. Uma nova medição no mesmo dia atualiza o registro existente.</p><form id="measurement-form"><div class="form-grid"><label class="span2">Projeto<select name="projectId" required>${eligibleProjects.map((project) => `<option value="${esc(project.id)}" ${project.id === defaultProject.id ? "selected" : ""}>${esc(project.name)} · ${esc(project.uf)}</option>`).join("")}</select></label>${field("Data da medição", "date", today(), "date", `required min="${defaultProject.start}" max="${today()}"`)}${field("Avanço real (%)", "progress", "", "number", 'required min="0" max="100" step="1"')}<label class="span2">Observação (opcional)<textarea name="note" rows="3" maxlength="500" placeholder="Ex.: medição aprovada pelo gestor"></textarea></label></div><div id="form-error" role="alert"></div><div class="modal-actions">${button("Cancelar", "close")}<button class="primary" type="submit">Salvar medição</button></div></form>`,
  );
  const form = $("#measurement-form");
  const fillExisting = () => {
    const project = state.projects.find(
      (item) => item.id === form.elements.projectId.value,
    );
    form.elements.date.min = project.start;
    const existing = (state.measurements || []).find(
      (measurement) =>
        measurement.projectId === project.id &&
        measurement.date === form.elements.date.value,
    );
    const previous = latestMeasurement(project.id, form.elements.date.value);
    form.elements.progress.value =
      existing?.progress ?? previous?.progress ?? "";
    form.elements.note.value = existing?.note ?? "";
  };
  form.elements.projectId.addEventListener("change", fillExisting);
  form.elements.date.addEventListener("change", fillExisting);
  fillExisting();
  form.onsubmit = async (eventObject) => {
    eventObject.preventDefault();
    const values = new FormData(form);
    const next = structuredClone(state);
    next.measurements ||= [];
    const project = next.projects.find(
      (item) => item.id === values.get("projectId"),
    );
    const date = values.get("date");
    const existing = next.measurements.find(
      (measurement) =>
        measurement.projectId === project.id && measurement.date === date,
    );
    const measurement = {
      id: existing?.id || crypto.randomUUID(),
      projectId: project.id,
      date,
      progress: Number(values.get("progress")),
      note: values.get("note").trim(),
    };
    if (existing) Object.assign(existing, measurement);
    else next.measurements.push(measurement);
    event(
      next,
      existing
        ? "Medição de avanço atualizada"
        : "Medição de avanço registrada",
      project.name,
      date,
      `${measurement.progress}%`,
    );
    try {
      validate(next);
      if (await persist(next, "Medição salva.")) closeDialog();
    } catch (error) {
      $("#form-error").textContent = error.message;
    }
  };
}
function curveSPage(projects) {
  const project =
    projects.find((item) => item.id === curveProjectId) || projects[0];
  curveProjectId = project?.id || "";
  if (!project) return empty("Cadastre um projeto para visualizar a Curva S.");
  const measurements = (state.measurements || [])
    .filter((measurement) => measurement.projectId === project.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const start = Date.parse(project.start + "T12:00:00Z");
  const end = Date.parse(project.end + "T12:00:00Z");
  const times = [
    start,
    end,
    ...measurements.map((measurement) =>
      Date.parse(measurement.date + "T12:00:00Z"),
    ),
  ];
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times, minTime + 86400000);
  const left = 72,
    right = 28,
    top = 30,
    bottom = 54,
    width = 960,
    height = 420;
  const chartWidth = width - left - right,
    chartHeight = height - top - bottom;
  const x = (time) =>
    left + ((time - minTime) / (maxTime - minTime)) * chartWidth;
  const y = (progress) => top + (1 - progress / 100) * chartHeight;
  const planned = [`${x(start)},${y(0)}`, `${x(end)},${y(100)}`].join(" ");
  const actual = measurements
    .map(
      (measurement) =>
        `${x(Date.parse(measurement.date + "T12:00:00Z"))},${y(measurement.progress)}`,
    )
    .join(" ");
  const yGrid = [0, 25, 50, 75, 100]
    .map(
      (progress) =>
        `<g><line x1="${left}" y1="${y(progress)}" x2="${width - right}" y2="${y(progress)}" class="chart-grid-line"/><text x="${left - 12}" y="${y(progress) + 4}" text-anchor="end" class="chart-axis-label">${progress}%</text></g>`,
    )
    .join("");
  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const time = minTime + ((maxTime - minTime) * index) / 4;
    const label = new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(time));
    return `<g><line x1="${x(time)}" y1="${top}" x2="${x(time)}" y2="${height - bottom}" class="chart-grid-line vertical"/><text x="${x(time)}" y="${height - 20}" text-anchor="middle" class="chart-axis-label">${esc(label)}</text></g>`;
  }).join("");
  const actualLine =
    measurements.length > 1
      ? `<polyline points="${actual}" class="curve-actual-line"/>`
      : "";
  const points = measurements
    .map(
      (measurement) =>
        `<circle cx="${x(Date.parse(measurement.date + "T12:00:00Z"))}" cy="${y(measurement.progress)}" r="5" class="curve-measurement-point"><title>${fmt(measurement.date)} · ${measurement.progress}%${measurement.note ? " · " + esc(measurement.note) : ""}</title></circle>`,
    )
    .join("");
  const latest = latestMeasurement(project.id);
  return `<section class="panel analytics-panel"><div class="analytics-toolbar"><div><h2>Avanço físico acumulado</h2><p>Planejado pela duração do projeto e avanço real medido.</p></div><div class="analytics-controls"><label>Projeto<select id="curve-project">${projects.map((item) => `<option value="${esc(item.id)}" ${item.id === project.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label>${button("＋ Registrar medição", "record-measurement", project.id, "primary")}</div></div><div class="curve-legend"><span><i class="planned-key"></i>Planejado (referência linear pelas datas)</span><span><i class="actual-key"></i>Real medido</span></div><div class="chart-scroll"><svg class="curve-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Curva S do projeto ${esc(project.name)}">${yGrid}${xTicks}<polyline points="${planned}" class="curve-planned-line"/>${actualLine}${points}<text x="${left}" y="${height - 3}" class="chart-axis-label">${fmt(project.start)}</text><text x="${width - right}" y="${height - 3}" text-anchor="end" class="chart-axis-label">${fmt(project.end)}</text></svg></div>${latest ? `<div class="measurement-summary"><b>Última medição: ${latest.progress}%</b><span>${fmt(latest.date)}${latest.note ? " · " + esc(latest.note) : ""}</span><span>Referência planejada na data: ${plannedProgressAt(project, latest.date)}%</span></div>` : '<div class="measurement-empty">Ainda não há medições reais para este projeto. Registre uma medição para iniciar a curva do avanço real.</div>'}<p class="chart-disclaimer">A linha planejada é uma referência linear entre as datas do projeto, não uma linha de base aprovada. Registre as medições reais periodicamente; não são gerados dados históricos automaticamente.</p></section>`;
}
function kpisPage(projects) {
  const overdue = projects.filter(
    (project) => project.status !== "Concluída" && project.end < today(),
  ).length;
  const active = projects.filter(
    (project) => project.status === "Ativa",
  ).length;
  const reports = projects
    .map((project) => ({ project, measurement: latestMeasurement(project.id) }))
    .filter((item) => item.measurement);
  const actualAverage = reports.length
    ? Math.round(
        reports.reduce((sum, item) => sum + item.measurement.progress, 0) /
          reports.length,
      )
    : null;
  const plannedAverage = reports.length
    ? Math.round(
        reports.reduce(
          (sum, item) =>
            sum + plannedProgressAt(item.project, item.measurement.date),
          0,
        ) / reports.length,
      )
    : null;
  const variance =
    actualAverage === null ? null : actualAverage - plannedAverage;
  const staffingAlerts = alerts(state).filter(
    (alert) =>
      alert.type === "staffing" &&
      projects.some((project) => project.id === alert.projectId),
  ).length;
  const allocated = state.employees.filter(
    (employee) =>
      employee.projectId &&
      projects.some((project) => project.id === employee.projectId),
  ).length;
  const metrics = [
    ["Projetos no filtro", projects.length, "Carteira selecionada", "project"],
    ["Projetos ativos", active, "Status Ativa", "clock"],
    [
      "Projetos fora do prazo",
      overdue,
      "Não concluídos com prazo vencido",
      "alert",
    ],
    [
      "Avanço real médio",
      actualAverage === null ? "—" : `${actualAverage}%`,
      `${reports.length} de ${projects.length} projetos com medição`,
      "curve",
    ],
    [
      "Desvio médio do plano",
      variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance} p.p.`,
      variance === null
        ? "Registre medições para calcular"
        : `Planejado na data: ${plannedAverage}%`,
      "kpi",
    ],
    [
      "Alertas de equipe",
      staffingAlerts,
      "Abaixo do mínimo por departamento",
      "people",
    ],
    [
      "Funcionários alocados",
      allocated,
      `${state.employees.filter((employee) => !employee.projectId).length} sem alocação na base`,
      "people",
    ],
  ];
  return `<div class="kpi-grid">${metrics.map(([label, value, caption, symbol]) => `<article class="panel kpi-card"><span>${esc(label)}${icon(symbol)}</span><strong>${value}</strong><small>${esc(caption)}</small></article>`).join("")}</div><section class="panel kpi-detail"><div class="panel-heading"><div><h2>Avanço medido por projeto</h2><p>O desvio compara a última medição com o prazo decorrido na data do registro.</p></div>${button("Ver Curva S", "nav", "curve-s", "text-button")}</div><div class="table-wrap"><table><thead><tr><th>PROJETO</th><th>STATUS</th><th>MEDIÇÃO</th><th>PLANEJADO NA DATA</th><th>DESVIO</th></tr></thead><tbody>${
    projects
      .map((project) => {
        const measurement = latestMeasurement(project.id);
        const planned = measurement
          ? plannedProgressAt(project, measurement.date)
          : null;
        const delta = measurement ? measurement.progress - planned : null;
        return `<tr><td><b>${esc(project.name)}</b><small>${esc(project.city)} · ${esc(project.uf)}</small></td><td>${badge(project)}</td><td>${measurement ? `${measurement.progress}%<small>${fmt(measurement.date)}</small>` : '<span class="muted">Sem medição</span>'}</td><td>${planned === null ? "—" : `${planned}%`}</td><td>${delta === null ? "—" : `<b class="${delta < 0 ? "danger-text" : "positive-text"}">${delta > 0 ? "+" : ""}${delta} p.p.</b>`}</td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="5">Nenhum projeto para os filtros.</td></tr>'
  }</tbody></table></div><p class="chart-disclaimer">Indicadores de avanço usam somente medições registradas. Projetos sem medição não entram nas médias de avanço/desvio.</p></section>`;
}
function ganttPage(projects) {
  if (!projects.length) return empty();
  const monthStart = (date) =>
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1);
  const firstMonth = Math.min(
    ...projects.map((project) => monthStart(project.start)),
  );
  const lastMonth = Math.max(
    ...projects.map((project) => monthStart(project.end)),
  );
  const monthCount = Math.max(
    1,
    (new Date(lastMonth).getUTCFullYear() -
      new Date(firstMonth).getUTCFullYear()) *
      12 +
      new Date(lastMonth).getUTCMonth() -
      new Date(firstMonth).getUTCMonth() +
      1,
  );
  const timelineStart = firstMonth;
  const timelineEnd = Date.UTC(
    new Date(lastMonth).getUTCFullYear(),
    new Date(lastMonth).getUTCMonth() + 1,
    1,
  );
  const chartWidth = Math.max(900, monthCount * 90);
  const labelWidth = 290,
    rowHeight = 58,
    headerHeight = 48,
    svgHeight = headerHeight + projects.length * rowHeight + 20,
    svgWidth = labelWidth + chartWidth + 24;
  const x = (date) =>
    labelWidth +
    ((Date.parse(date + "T12:00:00Z") - timelineStart) /
      (timelineEnd - timelineStart)) *
      chartWidth;
  const monthTicks = [];
  for (
    let time = timelineStart;
    time < timelineEnd;
    time = Date.UTC(
      new Date(time).getUTCFullYear(),
      new Date(time).getUTCMonth() + 1,
      1,
    )
  ) {
    const date = new Date(time);
    monthTicks.push(
      `<line x1="${labelWidth + ((time - timelineStart) / (timelineEnd - timelineStart)) * chartWidth}" y1="${headerHeight}" x2="${labelWidth + ((time - timelineStart) / (timelineEnd - timelineStart)) * chartWidth}" y2="${svgHeight}" class="chart-grid-line vertical"/><text x="${labelWidth + ((time - timelineStart) / (timelineEnd - timelineStart)) * chartWidth + 5}" y="29" class="gantt-month-label">${new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date)}</text>`,
    );
  }
  const rows = projects
    .map((project, index) => {
      const y = headerHeight + index * rowHeight;
      const startX = x(project.start),
        endX = x(project.end);
      const measurement = latestMeasurement(project.id);
      const progress = measurement
        ? measurement.progress
        : projectProgress(project);
      const fillWidth = Math.max(0, ((endX - startX) * progress) / 100);
      const statusClass =
        project.status === "Concluída"
          ? "complete"
          : project.status === "Pausada"
            ? "paused"
            : project.status === "Planejada"
              ? "planned"
              : "active";
      return `<g class="gantt-row"><line x1="0" y1="${y + rowHeight - 1}" x2="${svgWidth}" y2="${y + rowHeight - 1}" class="gantt-row-line"/><text x="12" y="${y + 22}" class="gantt-project-name">${esc(project.name)}</text><text x="12" y="${y + 40}" class="gantt-project-meta">${fmt(project.start)} → ${fmt(project.end)} · ${measurement ? "medido" : "estimado"}</text><text x="${labelWidth - 14}" y="${y + 31}" text-anchor="end" class="gantt-progress-label">${progress}%</text><rect x="${startX}" y="${y + 16}" width="${Math.max(3, endX - startX)}" height="22" rx="5" class="gantt-bar-plan"/><rect x="${startX}" y="${y + 16}" width="${Math.min(Math.max(3, endX - startX), fillWidth)}" height="22" rx="5" class="gantt-bar-actual ${statusClass}"><title>${esc(project.name)} · ${progress}% ${measurement ? "medido" : "estimado pelo prazo"}</title></rect><path d="M${endX - 5} ${y + 27}l5-5 5 5-5 5z" class="gantt-milestone"/></g>`;
    })
    .join("");
  const todayX =
    Date.parse(today() + "T12:00:00Z") >= timelineStart &&
    Date.parse(today() + "T12:00:00Z") <= timelineEnd
      ? `<line x1="${x(today())}" y1="${headerHeight}" x2="${x(today())}" y2="${svgHeight}" class="gantt-today-line"/><text x="${x(today()) + 5}" y="${headerHeight - 8}" class="gantt-today-label">Hoje</text>`
      : "";
  return `<section class="panel gantt-panel"><div class="analytics-toolbar"><div><h2>Prazo e avanço dos projetos</h2><p>Barra clara: duração planejada · preenchimento: avanço real medido ou estimado pelo prazo.</p></div><div class="gantt-legend"><span><i class="planned-key"></i>Planejado</span><span><i class="actual-key"></i>Avanço</span><span><i class="today-key"></i>Hoje</span></div></div><div class="gantt-scroll"><svg class="gantt-chart" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="Gráfico Gantt dos projetos selecionados"><text x="12" y="29" class="gantt-month-label">PROJETO · PRAZO · AVANÇO</text>${monthTicks.join("")}${todayX}${rows}</svg></div><p class="chart-disclaimer">O Gantt usa datas cadastradas. Quando existe medição, o preenchimento mostra o avanço real; sem medição, mostra a estimativa automática pelo tempo decorrido. Edite datas incorretas no cadastro do projeto.</p></section>`;
}
actions["record-measurement"] = (id) => measurementForm(id);
const renderStandard = render;
render = function () {
  const showSchedule = page === "schedule";
  if (showSchedule) page = "projects";
  renderStandard();
  if (!showSchedule) return;
  page = "schedule";
  document.querySelector(".page-heading h1").textContent = titles.schedule[0];
  document.querySelector(".page-heading p").textContent = titles.schedule[1];
  document.querySelector(".topbar > div").innerHTML =
    '<span class="breadcrumb">Workspace</span><span class="slash">/</span>Cronograma';
  document
    .querySelectorAll(".nav-item")
    .forEach((item) =>
      item.classList.toggle("active", item.dataset.id === "schedule"),
    );
  $("#page-content").innerHTML = schedulePage();
  wire();
};
const wireStandard = wire;
wire = function () {
  wireStandard();
  if (page === "schedule") {
    if ($("#schedule-month"))
      $("#schedule-month").onchange = (e) => {
        if (/^\d{4}-\d{2}$/.test(e.target.value)) {
          scheduleMonth = e.target.value;
          render();
        }
      };
    if ($("#schedule-department"))
      $("#schedule-department").onchange = (e) => {
        departmentFilter = e.target.value;
        render();
      };
  }
  if ($("#curve-project"))
    $("#curve-project").onchange = (e) => {
      curveProjectId = e.target.value;
      render();
    };
};
init();
