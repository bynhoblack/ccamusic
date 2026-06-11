// Portal CCA Music - Lógica de Negócios e Estado
// ==========================================

// Variáveis de Estado Global Sincronizadas
let members = [];
let songs = [];
let events = [];
let photos = [];
let currentUserId = "";

// Estado do Visualizador de Cifras
let currentViewingSong = null;
let currentKeyOffset = 0;
let autoScrollInterval = null;
let currentFontSize = 18; // px

const CHORDS_SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS_MAP = { "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#" };

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  checkAuth();
  setupUserSelector();
  setupNavigation();
  setupForms();
  setupAuthForms();
  renderActiveView();
  updateLiveDate();
});

// Carrega dados do localStorage
function loadData() {
  members = JSON.parse(localStorage.getItem("cca_members")) || [];
  songs = JSON.parse(localStorage.getItem("cca_songs")) || [];
  events = JSON.parse(localStorage.getItem("cca_events")) || [];
  photos = JSON.parse(localStorage.getItem("cca_photos")) || [];
  
  // Garante que se o usuário estiver logado, o ID do membro corresponda
  const loggedToken = localStorage.getItem("cca_auth_token");
  if (loggedToken) {
    const users = JSON.parse(localStorage.getItem("cca_users")) || [];
    const matched = users.find(u => u.email === loggedToken);
    if (matched) {
      currentUserId = matched.memberId;
      localStorage.setItem("cca_current_member", currentUserId);
      return;
    }
  }

  // Define usuário atual inicial
  const savedUser = localStorage.getItem("cca_current_member");
  if (savedUser && members.some(m => m.id === savedUser)) {
    currentUserId = savedUser;
  } else if (members.length > 0) {
    currentUserId = members[0].id;
    localStorage.setItem("cca_current_member", currentUserId);
  }
}

// Verifica status de autenticação
function checkAuth() {
  const token = localStorage.getItem("cca_auth_token");
  const overlay = document.getElementById("auth-screen-overlay");
  if (!token) {
    if (overlay) overlay.classList.add("active");
  } else {
    if (overlay) overlay.classList.remove("active");
  }
}

// Salva dados no localStorage e re-renderiza
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  loadData();
  renderActiveView();
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

  // Atualiza cargo do membro atual
  updateUserBadge();

  select.addEventListener("change", (e) => {
    currentUserId = e.target.value;
    localStorage.setItem("cca_current_member", currentUserId);
    updateUserBadge();
    renderActiveView();
  });
}

function updateUserBadge() {
  const badge = document.getElementById("user-role-badge");
  const currentMember = members.find(m => m.id === currentUserId);
  if (currentMember && badge) {
    badge.textContent = currentMember.role;
    // Ajusta visualização baseado no cargo
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
  // Aplica as permissões e restrições baseadas no accessLevel
  applyPermissions();
}

// Controla as permissões de acesso em tempo real
function applyPermissions() {
  const currentMember = members.find(m => m.id === currentUserId);
  const accessLevel = currentMember ? (currentMember.accessLevel || "Membro") : "Membro";

  // Encontra os botões de ação restritos ao administrador
  const btnAddEvent = document.querySelector("button[onclick=\"openModal('modal-add-event')\"]");
  const btnAddSong = document.querySelector("button[onclick=\"openModal('modal-add-song')\"]");
  const btnAddPhoto = document.querySelector("button[onclick=\"openModal('modal-add-photo')\"]");
  const btnAddMember = document.querySelector("button[onclick=\"openModal('modal-add-member')\"]");
  const navMembros = document.querySelector(".nav-item[data-tab=\"membros\"]");

  // Cria ou atualiza o indicador visual de Permissão/Acesso no perfil da barra lateral
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
    item.addEventListener("click", () => {
      const tab = item.getAttribute("data-tab");
      
      const currentMember = members.find(m => m.id === currentUserId);
      const accessLevel = currentMember ? (currentMember.accessLevel || "Membro") : "Membro";
      if (tab === "membros" && accessLevel !== "Administrador") {
        alert("Acesso restrito: Apenas administradores do portal podem acessar a aba de integrantes.");
        return;
      }

      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  const currentMember = members.find(m => m.id === currentUserId);
  const accessLevel = currentMember ? (currentMember.accessLevel || "Membro") : "Membro";
  if (tabId === "membros" && accessLevel !== "Administrador") {
    tabId = "dashboard";
  }

  const views = document.querySelectorAll(".tab-view");
  views.forEach(v => v.classList.remove("active"));
  
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.add("active");

  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");

  if (title && subtitle) {
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
  }

  renderActiveView(tabId);
}

function renderActiveView(tabId = null) {
  if (!tabId) {
    const activeTabItem = document.querySelector(".nav-item.active");
    tabId = activeTabItem ? activeTabItem.getAttribute("data-tab") : "dashboard";
  }

  switch(tabId) {
    case "dashboard":
      renderDashboard();
      break;
    case "escalas":
      renderEscalas();
      break;
    case "cifras":
      renderCifras();
      break;
    case "galeria":
      renderGaleria();
      break;
    case "membros":
      renderMembros();
      break;
  }
}

function updateLiveDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const liveDateEl = document.getElementById("live-date");
  if (liveDateEl) liveDateEl.textContent = new Date().toLocaleDateString('pt-BR', options);
}

// ================= RENDERIZADORES DE ABAS (CORRIGIDOS) =================

// 1. DASHBOARD
function renderDashboard() {
  const statSongs = document.getElementById("stat-songs-count");
  const statMembers = document.getElementById("stat-members-count");
  if (statSongs) statSongs.textContent = `${songs.length} Músicas`;
  if (statMembers) statMembers.textContent = `${members.length} Integrantes`;

  const todayStr = new Date().toISOString().split("T")[0];
  const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  let nextEvent = sortedEvents.find(e => e.date >= todayStr);
  if (!nextEvent && sortedEvents.length > 0) {
    nextEvent = sortedEvents[sortedEvents.length - 1];
  }

  if (nextEvent) {
    if (document.getElementById("dash-event-title")) document.getElementById("dash-event-title").textContent = nextEvent.title || nextEvent.name;
    if (document.getElementById("dash-event-time")) document.getElementById("dash-event-time").textContent = nextEvent.time || "-";
    if (document.getElementById("dash-event-arrival")) document.getElementById("dash-event-arrival").textContent = nextEvent.arrival || "-";
    if (document.getElementById("dash-event-dress")) document.getElementById("dash-event-dress").textContent = nextEvent.dress || "-";
    
    if (document.getElementById("stat-next-date")) {
      const d = new Date(nextEvent.date + 'T00:00:00');
      document.getElementById("stat-next-date").textContent = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    // Listagem da Escala no Painel
    const scaleListEl = document.getElementById("dash-event-scale-list");
    if (scaleListEl) {
      scaleListEl.innerHTML = "";
      if (nextEvent.scale && nextEvent.scale.length > 0) {
        nextEvent.scale.forEach(mId => {
          const m = members.find(member => member.id === mId);
          if (m) {
            const li = document.createElement("li");
            li.textContent = `${m.name} - ${m.role}`;
            scaleListEl.appendChild(li);
          }
        });
      } else {
        scaleListEl.innerHTML = "<li>Nenhum integrante escalado.</li>";
      }
    }

    // Listagem de Músicas no Painel
    const songsListEl = document.getElementById("dash-event-songs-list");
    if (songsListEl) {
      songsListEl.innerHTML = "";
      if (nextEvent.songs && nextEvent.songs.length > 0) {
        nextEvent.songs.forEach(sId => {
          const s = songs.find(song => song.id === sId);
          if (s) {
            const p = document.createElement("p");
            p.className = "dash-song-item";
            p.textContent = `🎵 ${s.title} (${s.tone || 'N/A'})`;
            songsListEl.appendChild(p);
          }
        });
      } else {
        songsListEl.innerHTML = "<p class='text-secondary'>Nenhuma música adicionada.</p>";
      }
    }
  } else {
    if (document.getElementById("dash-event-title")) document.getElementById("dash-event-title").textContent = "Nenhum evento agendado.";
    if (document.getElementById("dash-event-time")) document.getElementById("dash-event-time").textContent = "-";
    if (document.getElementById("dash-event-arrival")) document.getElementById("dash-event-arrival").textContent = "-";
    if (document.getElementById("dash-event-dress")) document.getElementById("dash-event-dress").textContent = "-";
    if (document.getElementById("stat-next-date")) document.getElementById("stat-next-date").textContent = "--/--";
  }
}

// 2. ESCALAS
function renderEscalas() {
  const container = document.getElementById("escalas-list-container");
  if (!container) return;
  container.innerHTML = events.length === 0 ?