// Configura as credenciais no cliente global já existente
const SUPABASE_URL = 'https://ldsyjywdufhrblncadvj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3lqeXdkdWZocmJsbmNhZHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTM5ODMsImV4cCI6MjA5NjU4OTk4M30.9CO7Jziy-VItNFlpDGKlkrV6f_DPXwmq-Mdu5rRYaCk';

// Sobrescreve a instância com a conexão do seu projeto usando o cliente global
supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_SECURITY_CODE = "CCA2026"; // Código de validação para novos administradores

// Cabeçalhos padrão para requisições assíncronas na REST API
const getHeaders = () => ({
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
});

// Variáveis de Estado Global Sincronizadas com o Banco
let members = [];
let songs = [];
let events = [];
let photos = [];
let presencesCache = []; // Cache local para mapeamento relacional de presenças
let currentUserId = "";

// Estado do Visualizador de Cifras (Preservado)
let currentViewingSong = null;
let currentKeyOffset = 0;
let autoScrollInterval = null;
let currentFontSize = 18; // px
let originalSongChords = "";

const CHORDS_SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Inicialização Assíncrona
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  checkAuth();
  setupNavigation();
  setupForms();
  setupAuthForms();
  updateLiveDate();
});

// Carrega dados diretamente da API do Supabase em paralelo
async function loadData() {
  try {
    const [resMembers, resSongs, resEvents, resPhotos, resPresences] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/members?order=name.asc`, { headers: getHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/songs?order=title.asc nudge`, { headers: getHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/events?order=date.asc`, { headers: getHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/photos?order=created_at.desc`, { headers: getHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/presences`, { headers: getHeaders() })
    ]);

    members = await resMembers.json();
    songs = await resSongs.json();
    events = await resEvents.json();
    photos = await resPhotos.json();
    presencesCache = await resPresences.json();

    // Vincula as presenças salvas dentro de seus respectivos objetos de eventos mapeados
    events.forEach(ev => {
      ev.presences = {};
      const filtradas = presencesCache.filter(p => p.event_id === ev.id);
      filtradas.forEach(p => {
        ev.presences[p.member_id] = { status: p.status, reason: p.reason };
      });
    });

    // Gerencia o Token de Sessão ativa
    const loggedUserJson = localStorage.getItem("cca_user");
    if (loggedUserJson) {
      const savedUser = JSON.parse(loggedUserJson);
      // Garante que os dados locais do usuário ativo estejam atualizados com o banco
      const matched = members.find(m => m.id === savedUser.id);
      if (matched) {
        currentUserId = matched.id;
        setupUserSelector();
        renderActiveView();
        return;
      }
    }

    if (members.length > 0) {
      currentUserId = members[0].id;
      setupUserSelector();
    }

    renderActiveView();
  } catch (err) {
    console.error("Erro fatal ao sincronizar dados com o Supabase:", err);
  }
}

// Verifica status de autenticação
function checkAuth() {
  const token = localStorage.getItem("cca_user");
  const overlay = document.getElementById("auth-screen-overlay");
  if (!token) {
    overlay.classList.add("active");
  } else {
    overlay.classList.remove("active");
  }
}

// Configura o Seletor de Membros na Sidebar
function setupUserSelector() {
  const select = document.getElementById("current-user-select");
  if (!select) return;
  
  select.innerHTML = "";
  members.forEach(member => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = member.nickname ? `${member.nickname} (${member.name.split(" ")[0]})` : member.name;
    if (member.id === currentUserId) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  updateUserBadge();

  // Permite chaveamento rápido no simulador da barra lateral
  select.onchange = (e) => {
    currentUserId = e.target.value;
    const novoUsuarioContexto = members.find(m => m.id === currentUserId);
    if(novoUsuarioContexto) {
      localStorage.setItem("cca_user", JSON.stringify(novoUsuarioContexto));
    }
    updateUserBadge();
    renderActiveView();
  };
}

function updateUserBadge() {
  const badge = document.getElementById("user-role-badge");
  if (!badge) return;
  
  const currentMember = members.find(m => m.id === currentUserId);
  if (currentMember) {
    badge.textContent = currentMember.role;
    if (currentMember.role === "Membro" || currentMember.role === "Apoio") {
      badge.style.borderColor = "var(--accent-cyan)";
      badge.style.color = "var(--accent-cyan)";
      badge.style.backgroundColor = "var(--accent-cyan-glow)";
    } else {
      badge.style.borderColor = "var(--accent-purple)";
      badge.style.color = "var(--accent-purple)";
      badge.style.backgroundColor = "var(--accent-purple-glow)";
    }
  }
  applyPermissions();
}

// Controla as permissões de acesso baseando-se no access_level gravado no banco de dados
function applyPermissions() {
  const currentMember = members.find(m => m.id === currentUserId);
  const accessLevel = currentMember ? (currentMember.access_level || "Membro") : "Membro";

  const btnAddEvent = document.querySelector("button[onclick=\"openModal('modal-add-event')\"]");
  const btnAddSong = document.querySelector("button[onclick=\"openModal('modal-add-song')\"]");
  const btnAddPhoto = document.querySelector("button[onclick=\"openModal('modal-add-photo')\"]");
  const btnAddMember = document.querySelector("button[onclick=\"openModal('modal-add-member')\"]");
  const navMembros = document.querySelector(".nav-item[data-tab=\"membros\"]");

  let permBadge = document.getElementById("user-permission-badge");
  if (!permBadge) {
    permBadge = document.createElement("span");
    permBadge.id = "user-permission-badge";
    permBadge.className = "user-badge";
    permBadge.style.display = "inline-block";
    permBadge.style.marginTop = "0.35rem";
    permBadge.style.fontSize = "0.7rem";
    permBadge.style.fontWeight = "700";
    permBadge.style.textAlign = "center";
    const roleBadge = document.getElementById("user-role-badge");
    if (roleBadge) {
      roleBadge.parentNode.insertBefore(permBadge, roleBadge.nextSibling);
    }
  }

  if (accessLevel === "Administrador") {
    permBadge.innerHTML = "<i class='fa-solid fa-crown'></i> Administrador";
    permBadge.style.borderColor = "#D4AF37";
    permBadge.style.color = "#D4AF37";
    permBadge.style.backgroundColor = "rgba(212, 175, 55, 0.15)";

    if (btnAddEvent) btnAddEvent.style.display = "inline-flex";
    if (btnAddSong) btnAddSong.style.display = "inline-flex";
    if (btnAddPhoto) btnAddPhoto.style.display = "inline-flex";
    if (btnAddMember) btnAddMember.style.display = "inline-flex";
    if (navMembros) navMembros.style.display = "flex";
  } else {
    permBadge.innerHTML = "<i class='fa-solid fa-user-shield'></i> Integrante";
    permBadge.style.borderColor = "var(--text-muted)";
    permBadge.style.color = "var(--text-muted)";
    permBadge.style.backgroundColor = "rgba(255, 255, 255, 0.05)";

    if (btnAddEvent) btnAddEvent.style.display = "none";
    if (btnAddSong) btnAddSong.style.display = "none";
    if (btnAddPhoto) btnAddPhoto.style.display = "none";
    if (btnAddMember) btnAddMember.style.display = "none";
    if (navMembros) navMembros.style.display = "none";

    const activeTabItem = document.querySelector(".nav-item.active");
    if (activeTabItem && activeTabItem.getAttribute("data-tab") === "membros") {
      const dashTab = document.querySelector(".nav-item[data-tab=\"dashboard\"]");
      if (dashTab) dashTab.click();
    }
  }
}

// Configura o Roteamento SPA por Abas
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.onclick = () => {
      const tab = item.getAttribute("data-tab");
      const currentMember = members.find(m => m.id === currentUserId);
      const accessLevel = currentMember ? (currentMember.access_level || "Membro") : "Membro";
      
      if (tab === "membros" && accessLevel !== "Administrador") {
        alert("Acesso restrito: Apenas administradores do portal podem acessar a aba de integrantes.");
        return;
      }

      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");
      switchTab(tab);
    };
  });
}

function switchTab(tabId) {
  const currentMember = members.find(m => m.id === currentUserId);
  const accessLevel = currentMember ? (currentMember.access_level || "Membro") : "Membro";
  if (tabId === "membros" && accessLevel !== "Administrador") {
    tabId = "dashboard";
  }

  document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.add("active");

  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");

  switch(tabId) {
    case "dashboard":
      title.textContent = "Painel Geral";
      subtitle.textContent = "Visão geral do grupo e próximos compromissos.";
      break;
    case "escalas":
      title.textContent = "Escalas & Presença";
      subtitle.textContent = "Planejamento dos eventos e controle de assiduidade.";
      break;
    case "cifras":
      title.textContent = "Banco de Cifras";
      subtitle.textContent = "Repertório do grupo com transposição interativa.";
      break;
    case "galeria":
      title.textContent = "Galeria do Grupo";
      subtitle.textContent = "Fotos oficiais, ensaios e momentos de comunhão.";
      break;
    case "membros":
      title.textContent = "Integrantes do Grupo";
      subtitle.textContent = "Ficha cadastral e estatísticas de assiduidade.";
      break;
  }

  renderActiveView(tabId);
}

function renderActiveView(tabId = null) {
  if (!tabId) {
    const activeTabItem = document.querySelector(".nav-item.active");
    tabId = activeTabItem ? activeTabItem.getAttribute("data-tab") : "dashboard";
  }

  switch(tabId) {
    case "dashboard": renderDashboard(); break;
    case "escalas": renderEscalas(); break;
    case "cifras": renderCifras(); break;
    case "galeria": renderGaleria(); break;
    case "membros": renderMembros(); break;
  }
}

function updateLiveDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("live-date").textContent = new Date().toLocaleDateString('pt-BR', options);
}

// Auxiliares globais de Modais e Lightbox
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add("active");
    if (id === 'modal-add-event') populateEventSelectors();
  }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("active");
}
function openLightbox(url, caption) {
  document.getElementById("lightbox-img").src = url;
  document.getElementById("lightbox-caption").textContent = caption;
  document.getElementById("lightbox").classList.add("active");
}
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("active");
}
function formatDateShort(dateStr) {
  if(!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

// Preenche listas dinâmicas de seleção no formulário de escala
function populateEventSelectors() {
  const songsBox = document.getElementById("event-songs-checkboxes");
  if (songsBox) {
    songsBox.innerHTML = songs.map(s => `
      <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; font-size: 0.85rem; cursor:pointer;">
        <input type="checkbox" name="event-songs-select" value="${s.id}"> ${s.title} (${s.artist})
      </label>
    `).join("");
  }

  const teamBox = document.getElementById("event-team-selector");
  if (teamBox) {
    teamBox.innerHTML = members.map(m => `
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.02); padding: 0.4rem; border-radius: 4px;">
        <input type="checkbox" name="event-members-select" value="${m.id}" onchange="document.getElementById('role-for-${m.id}').disabled = !this.checked">
        <span style="font-size:0.85rem; flex: 1;">${m.name}</span>
        <input type="text" id="role-for-${m.id}" placeholder="Função (Ex: ${m.instrument})" disabled style="width: 140px; padding: 0.2rem; font-size: 0.8rem; background: #222; border: 1px solid #444; color: #fff; border-radius: 4px;">
      </div>
    `).join("");
  }
}

// ==================== RENDERIZADORES DE ABAS ====================

// 1. DASHBOARD
function renderDashboard() {
  document.getElementById("stat-songs-count").textContent = `${songs.length} Músicas`;
  document.getElementById("stat-members-count").textContent = `${members.length} Integrantes`;

  const todayStr = new Date().toISOString().split("T")[0];
  const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  let nextEvent = sortedEvents.find(e => e.date >= todayStr);
  if (!nextEvent && sortedEvents.length > 0) {
    nextEvent = sortedEvents[sortedEvents.length - 1];
  }

  if (!nextEvent) {
    document.getElementById("dash-event-title").textContent = "Nenhum evento agendado.";
    document.getElementById("dash-event-time").textContent = "-";
    document.getElementById("dash-event-arrival").textContent = "-";
    document.getElementById("dash-event-dress").textContent = "-";
    document.getElementById("dash-event-colors").innerHTML = "";
    document.getElementById("dash-event-scale-list").innerHTML = "<li>Nenhum integrante escalado.</li>";
    document.getElementById("dash-event-songs-list").innerHTML = "<p class='text-secondary'>Nenhuma música adicionada.</p>";
    document.getElementById("stat-next-date").textContent = "Sem Escala";
    document.getElementById("dash-presence-actions").innerHTML = "";
    return;
  }

  document.getElementById("stat-next-date").textContent = formatDateShort(nextEvent.date);
  document.getElementById("dash-event-title").textContent = `${nextEvent.title} (${nextEvent.type})`;
  document.getElementById("dash-event-time").textContent = `${nextEvent.time.substring(0,5)}h`;
  document.getElementById("dash-event-arrival").textContent = `${nextEvent.arrival_time.substring(0,5)}h`;
  document.getElementById("dash-event-dress").textContent = nextEvent.dress_code || "Livre";

  const colorsContainer = document.getElementById("dash-event-colors");
  colorsContainer.innerHTML = "";
  if (nextEvent.dress_colors && nextEvent.dress_colors.length > 0) {
    nextEvent.dress_colors.forEach(color => {
      const dot = document.createElement("div");
      dot.className = "color-dot";
      dot.style.backgroundColor = color.trim();
      dot.title = color.trim();
      colorsContainer.appendChild(dot);
    });
  }

  const presenceActions = document.getElementById("dash-presence-actions");
  presenceActions.innerHTML = "";
  
  const isScaled = nextEvent.team && nextEvent.team.some(t => t.memberId === currentUserId);
  const currentPresence = nextEvent.presences[currentUserId];

  if (!isScaled) {
    presenceActions.innerHTML = `<span class="presence-status-banner pending"><i class="fa-solid fa-circle-exclamation"></i> Você não está escalado</span>`;
  } else {
    const status = currentPresence ? currentPresence.status : "pending";
    const reason = currentPresence ? currentPresence.reason : "";

    if (status === "confirmed") {
      presenceActions.innerHTML = `
        <span class="presence-status-banner confirmed"><i class="fa-solid fa-circle-check"></i> Presença Confirmada!</span>
        <button class="btn btn-xs btn-outline text-danger" onclick="triggerAbsenceModal('${nextEvent.id}', '${currentUserId}')">
          <i class="fa-solid fa-circle-xmark"></i> Alterar para Falta
        </button>
      `;
    } else if (status === "declined") {
      presenceActions.innerHTML = `
        <span class="presence-status-banner declined" title="Justificativa: ${reason}"><i class="fa-solid fa-circle-xmark"></i> Ausente Justificado</span>
        <button class="btn btn-xs btn-primary" onclick="setPresence('${nextEvent.id}', '${currentUserId}', 'confirmed')">
          <i class="fa-solid fa-circle-check"></i> Mudar para Confirmado
        </button>
      `;
    } else {
      presenceActions.innerHTML = `
        <button class="btn btn-primary" onclick="setPresence('${nextEvent.id}', '${currentUserId}', 'confirmed')">
          <i class="fa-solid fa-circle-check"></i> Confirmar Presença
        </button>
        <button class="btn btn-secondary text-danger" onclick="triggerAbsenceModal('${nextEvent.id}', '${currentUserId}')">
          <i class="fa-solid fa-circle-xmark"></i> Recusar / Falta
        </button>
      `;
    }
  }

  const scaleList = document.getElementById("dash-event-scale-list");
  scaleList.innerHTML = "";
  
  if(nextEvent.team) {
    nextEvent.team.forEach(t => {
      const m = members.find(member => member.id === t.memberId);
      if (!m) return;

      const presenceInfo = next