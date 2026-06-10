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

  // Define usuário atual inicial (Gabriela Silva por padrão)
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
    overlay.classList.add("active");
  } else {
    overlay.classList.remove("active");
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
  const badge = document.getElementById("user-role-badge");
  
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
  if (currentMember) {
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
    // Estilo ouro reluzente para Administradores
    permBadge.innerHTML = "<i class='fa-solid fa-crown'></i> Administrador";
    permBadge.style.borderColor = "#D4AF37";
    permBadge.style.color = "#D4AF37";
    permBadge.style.backgroundColor = "rgba(212, 175, 55, 0.15)";

    // Habilita visualização e ações
    if (btnAddEvent) btnAddEvent.style.display = "inline-flex";
    if (btnAddSong) btnAddSong.style.display = "inline-flex";
    if (btnAddPhoto) btnAddPhoto.style.display = "inline-flex";
    if (btnAddMember) btnAddMember.style.display = "inline-flex";
    if (navMembros) navMembros.style.display = "flex";
  } else {
    // Estilo prata/cinza fosco para Membros comuns
    permBadge.innerHTML = "<i class='fa-solid fa-user-shield'></i> Integrante";
    permBadge.style.borderColor = "var(--text-muted)";
    permBadge.style.color = "var(--text-muted)";
    permBadge.style.backgroundColor = "rgba(255, 255, 255, 0.05)";

    // Oculta todas as ações de adição/edição administrativa
    if (btnAddEvent) btnAddEvent.style.display = "none";
    if (btnAddSong) btnAddSong.style.display = "none";
    if (btnAddPhoto) btnAddPhoto.style.display = "none";
    if (btnAddMember) btnAddMember.style.display = "none";
    
    // Oculta a aba de Membros/Integrantes do menu lateral
    if (navMembros) navMembros.style.display = "none";

    // Se estiver na aba Membros (que agora é oculta), joga de volta pro Dashboard
    const activeTabItem = document.querySelector(".nav-item.active");
    if (activeTabItem && activeTabItem.getAttribute("data-tab") === "membros") {
      const dashTab = document.querySelector(".nav-item[data-tab=\"dashboard\"]");
      if (dashTab) {
        dashTab.click();
      }
    }
  }
}

// Configura o Roteamento SPA por Abas
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tab = item.getAttribute("data-tab");
      
      // Validação rápida de rota para segurança adicional na UI
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
  // Valida permissão da aba membros
  const currentMember = members.find(m => m.id === currentUserId);
  const accessLevel = currentMember ? (currentMember.accessLevel || "Membro") : "Membro";
  if (tabId === "membros" && accessLevel !== "Administrador") {
    tabId = "dashboard";
  }

  // Oculta todas as views
  const views = document.querySelectorAll(".tab-view");
  views.forEach(v => v.classList.remove("active"));
  
  // Exibe a ativa
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.add("active");

  // Ajusta títulos da header
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

// Exibe a Data do Dia Traduzida
function updateLiveDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("live-date").textContent = new Date().toLocaleDateString('pt-BR', options);
}

// ================= RENDERIZADORES DE ABAS =================

// 1. DASHBOARD
function renderDashboard() {
  // Atualiza Estatísticas no topo
  document.getElementById("stat-songs-count").textContent = `${songs.length} Músicas`;
  document.getElementById("stat-members-count").textContent = `${members.length} Integrantes`;

  // Identifica o próximo evento cronológico baseado em data
  const todayStr = new Date().toISOString().split("T")[0];
  
  // Ordena os eventos pela data (mais próximos primeiro)
  const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Pega o primeiro evento cuja data seja igual ou posterior a hoje, ou o mais recente da lista se todos forem no passado
  let nextEvent = sortedEvents.find(e => e.date >= todayStr);
  if (!nextEvent && sortedEvents.length > 0) {
    nextEvent = sortedEvents[sortedEvents.length - 1]; // pega o último
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

  // Preenche dados do evento destacado
  document.getElementById("stat-next-date").textContent = formatDateShort(nextEvent.date);
  document.getElementById("dash-event-title").textContent = `${nextEvent.title} (${nextEvent.type})`;
  document.getElementById("dash-event-time").textContent = `${nextEvent.time}h`;
  document.getElementById("dash-event-arrival").textContent = `${nextEvent.arrivalTime}h`;
  document.getElementById("dash-event-dress").textContent = nextEvent.dressCode || "Livre";

  // Desenha as bolinhas de cores da paleta
  const colorsContainer = document.getElementById("dash-event-colors");
  colorsContainer.innerHTML = "";
  if (nextEvent.dressColors && nextEvent.dressColors.length > 0) {
    nextEvent.dressColors.forEach(color => {
      const dot = document.createElement("div");
      dot.className = "color-dot";
      dot.style.backgroundColor = color.trim();
      dot.title = color.trim();
      colorsContainer.appendChild(dot);
    });
  } else if (nextEvent.dressCode && nextEvent.dressCode.toLowerCase().includes("preto")) {
    const dot = document.createElement("div");
    dot.className = "color-dot";
    dot.style.backgroundColor = "#000000";
    colorsContainer.appendChild(dot);
  }

  // Ações rápidas de presença do Membro Simulado
  const presenceActions = document.getElementById("dash-presence-actions");
  presenceActions.innerHTML = "";
  
  // Verifica se o usuário atual está escalado neste evento
  const isScaled = nextEvent.team.some(t => t.memberId === currentUserId);
  const currentPresence = nextEvent.presences[currentUserId];

  if (!isScaled) {
    presenceActions.innerHTML = `<span class="presence-status-banner pending"><i class="fa-solid fa-circle-exclamation"></i> Você não está escalado neste evento</span>`;
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

  // Preenche a Escala Detalhada de Integrantes
  const scaleList = document.getElementById("dash-event-scale-list");
  scaleList.innerHTML = "";
  
  nextEvent.team.forEach(t => {
    const m = members.find(member => member.id === t.memberId);
    if (!m) return;

    const presenceInfo = nextEvent.presences[m.id] || { status: "pending", reason: "" };
    
    let statusClass = "pending";
    let statusIcon = '<i class="fa-regular fa-clock"></i>';
    let statusText = "Pendente";
    let tooltip = "";

    if (presenceInfo.status === "confirmed") {
      statusClass = "confirmed";
      statusIcon = '<i class="fa-solid fa-check"></i>';
      statusText = "Confirmado";
    } else if (presenceInfo.status === "declined") {
      statusClass = "declined";
      statusIcon = '<i class="fa-solid fa-xmark"></i>';
      statusText = "Ausente";
      tooltip = `title="Justificativa: ${presenceInfo.reason || 'Não informada'}"`;
    }

    const li = document.createElement("li");
    li.className = "scale-member-item";
    li.innerHTML = `
      <div class="scale-member-left">
        <img class="scale-member-avatar" src="${m.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80'}" alt="${m.name}">
        <div class="scale-member-info">
          <h4>${m.name}</h4>
          <span>${t.role}</span>
        </div>
      </div>
      <span class="status-indicator ${statusClass}" ${tooltip}>
        ${statusIcon} ${statusText}
      </span>
    `;
    scaleList.appendChild(li);
  });

  // Preenche a Lista de Músicas do Dia
  const songsList = document.getElementById("dash-event-songs-list");
  songsList.innerHTML = "";
  
  if (nextEvent.songs && nextEvent.songs.length > 0) {
    nextEvent.songs.forEach(songId => {
      const s = songs.find(song => song.id === songId);
      if (!s) return;

      const card = document.createElement("div");
      card.className = "song-link-card";
      card.onclick = () => openCifraViewer(s.id);
      card.innerHTML = `
        <div class="song-link-info">
          <h4>${s.title}</h4>
          <span>${s.artist}</span>
        </div>
        <span class="song-link-key">${s.key}</span>
      `;
      songsList.appendChild(card);
    });
  } else {
    songsList.innerHTML = "<p class='text-secondary font-sm'>Nenhuma música cifrada vinculada a este dia.</p>";
  }
}

// 2. ESCALAS
function renderEscalas() {
  const container = document.getElementById("events-cards-container");
  container.innerHTML = "";

  if (events.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <i class="fa-solid fa-calendar-times" style="font-size: 3rem; margin-bottom: 1rem; color: var(--text-muted);"></i>
        <h3>Nenhuma escala cadastrada</h3>
        <p class="text-secondary" style="margin-top: 0.5rem;">Crie novos eventos de louvor ou ensaios para escalação da banda.</p>
      </div>
    `;
    return;
  }

  // Ordena por data mais recente
  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(ev => {
    // Conta presenças
    let conf = 0, dec = 0, pend = 0;
    ev.team.forEach(t => {
      const pres = ev.presences[t.memberId] ? ev.presences[t.memberId].status : "pending";
      if (pres === "confirmed") conf++;
      else if (pres === "declined") dec++;
      else pend++;
    });

    const isEnsaio = ev.type.toLowerCase().includes("ensaio");
    
    // Paleta de roupas
    let dotsHtml = "";
    if (ev.dressColors) {
      ev.dressColors.forEach(c => {
        dotsHtml += `<div class="color-dot" style="background-color: ${c.trim()};" title="${c.trim()}"></div>`;
      });
    }

    const card = document.createElement("div");
    card.className = `card event-card ${isEnsaio ? 'card-ensaio' : ''}`;
    
    // Lista resumida da escala para o card
    let scaleBadges = "";
    ev.team.forEach(t => {
      const m = members.find(member => member.id === t.memberId);
      if (m) {
        const pres = ev.presences[m.id] ? ev.presences[m.id].status : "pending";
        let color = "var(--text-muted)";
        if (pres === "confirmed") color = "var(--color-success)";
        else if (pres === "declined") color = "var(--color-danger)";
        
        scaleBadges += `
          <span class="scale-member-badge" style="border-color: ${color};">
            <span style="color: ${color}; font-size: 0.6rem;"><i class="fa-solid fa-circle"></i></span>
            ${m.name.split(" ")[0]} (${t.role})
          </span>
        `;
      }
    });

    // Músicas tags
    let songsTags = "";
    ev.songs.forEach(songId => {
      const s = songs.find(song => song.id === songId);
      if (s) {
        songsTags += `<span class="song-tag cifra-link" onclick="event.stopPropagation(); openCifraViewer('${s.id}')"><i class="fa-solid fa-guitar"></i> ${s.title}</span>`;
      }
    });

    card.innerHTML = `
      <div class="event-card-header">
        <span class="event-type-tag">${ev.type}</span>
        <span class="event-date-badge"><i class="fa-regular fa-calendar"></i> ${formatDateShort(ev.date)}</span>
      </div>
      <div class="event-card-body">
        <h3>${ev.title}</h3>
        <div class="event-meta-block">
          <div><i class="fa-regular fa-clock"></i> Início: <strong>${ev.time}h</strong> (Chegada: <span class="time-arrival">${ev.arrivalTime}h</span>)</div>
          <div><i class="fa-solid fa-shirt"></i> Roupas: <strong>${ev.dressCode || 'Livre'}</strong></div>
          <div class="color-palette-preview">${dotsHtml}</div>
        </div>
        
        <div class="event-scale-preview">
          <h4>Integrantes (${conf} Confirmados, ${dec} Ausentes, ${pend} P)</h4>
          <div class="scale-members-flex">${scaleBadges}</div>
        </div>

        <div class="event-scale-preview">
          <h4>Repertório / Cifras</h4>
          <div class="song-tags-box">${songsTags || '<span class="text-secondary font-sm">Sem músicas selecionadas</span>'}</div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// 3. CIFRAS
function renderCifras() {
  const container = document.getElementById("cifras-cards-container");
  const searchQuery = document.getElementById("search-cifras").value.toLowerCase();
  const rhythmFilter = document.getElementById("filter-rhythm").value;
  
  container.innerHTML = "";

  const filtered = songs.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery) ||
                          s.artist.toLowerCase().includes(searchQuery) ||
                          s.key.toLowerCase().includes(searchQuery) ||
                          s.tags.some(t => t.toLowerCase().includes(searchQuery));
    const matchesRhythm = !rhythmFilter || s.rhythm === rhythmFilter;
    return matchesSearch && matchesRhythm;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <i class="fa-solid fa-guitar" style="font-size: 3rem; margin-bottom: 1rem; color: var(--text-muted);"></i>
        <h3>Nenhuma cifra encontrada</h3>
        <p class="text-secondary" style="margin-top: 0.5rem;">Use outros termos de busca ou adicione uma nova cifra.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(s => {
    const card = document.createElement("div");
    card.className = "card cifra-card";
    card.onclick = () => openCifraViewer(s.id);

    let tagsHtml = "";
    s.tags.forEach(t => {
      tagsHtml += `<span class="song-tag">${t}</span>`;
    });

    card.innerHTML = `
      <div class="cifra-card-top">
        <div>
          <h3>${s.title}</h3>
          <p class="text-secondary">${s.artist}</p>
        </div>
        <span class="cifra-card-key">${s.key}</span>
      </div>
      <p class="font-sm" style="color: var(--accent-cyan); font-weight: 500;">Ritmo: ${s.rhythm}</p>
      <div class="song-tags-box">${tagsHtml}</div>
    `;
    container.appendChild(card);
  });

  // Listener para busca em tempo real
  if (!document.getElementById("search-cifras").dataset.hasListener) {
    document.getElementById("search-cifras").addEventListener("input", renderCifras);
    document.getElementById("filter-rhythm").addEventListener("change", renderCifras);
    document.getElementById("search-cifras").dataset.hasListener = "true";
  }
}

// 4. GALERIA
function renderGaleria() {
  const container = document.getElementById("gallery-container");
  container.innerHTML = "";

  if (photos.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1/-1; text-align: center; padding: 3rem; width: 100%;">
        <i class="fa-solid fa-images" style="font-size: 3rem; margin-bottom: 1rem; color: var(--text-muted);"></i>
        <h3>Galeria de fotos vazia</h3>
        <p class="text-secondary" style="margin-top: 0.5rem;">Carregue fotos de apresentações e ensaios do grupo.</p>
      </div>
    `;
    return;
  }

  photos.forEach(p => {
    const div = document.createElement("div");
    div.className = "gallery-item";
    div.onclick = () => openLightbox(p.url, p.caption);
    div.innerHTML = `
      <img src="${p.url}" alt="${p.caption}" loading="lazy">
      <div class="gallery-caption">${p.caption}</div>
    `;
    container.appendChild(div);
  });
}

// 5. INTEGRANTES
function renderMembros() {
  const container = document.getElementById("members-container");
  container.innerHTML = "";

  if (members.length === 0) {
    container.innerHTML = `<h3>Nenhum membro cadastrado</h3>`;
    return;
  }

  // Determina nível de acesso do usuário atual
  const currentUser = members.find(member => member.id === currentUserId);
  const accessLevel = currentUser ? (currentUser.accessLevel || "Membro") : "Membro";

  members.forEach(m => {
    // Calcula estatísticas de presença
    let totalScaled = 0;
    let confirmedCount = 0;
    let absenceReasons = [];

    events.forEach(ev => {
      const isScaled = ev.team.some(t => t.memberId === m.id);
      if (isScaled) {
        totalScaled++;
        const presence = ev.presences[m.id];
        if (presence && presence.status === "confirmed") {
          confirmedCount++;
        } else if (presence && presence.status === "declined") {
          absenceReasons.push({
            eventTitle: ev.title,
            reason: presence.reason || "Não informado",
            date: formatDateShort(ev.date)
          });
        }
      }
    });

    const attendanceRate = totalScaled > 0 ? Math.round((confirmedCount / totalScaled) * 100) : 100;
    
    // Lista de faltas justificadas
    let reasonsHtml = "";
    if (absenceReasons.length > 0) {
      reasonsHtml += `<div class="member-absence-reasons-list">
        <h5>Faltas Justificadas:</h5>
        ${absenceReasons.map(r => `<div><strong>${r.date}:</strong> ${r.reason} (${r.eventTitle})</div>`).join("")}
      </div>`;
    }

    // Botão de Excluir Membro para Administradores
    let deleteBtnHtml = "";
    if (accessLevel === "Administrador" && m.id !== currentUserId) {
      deleteBtnHtml = `
        <button class="btn btn-secondary text-danger" onclick="excluirMembro('${m.id}')" style="margin-top: 1rem; width: 100%; border-color: rgba(239, 68, 68, 0.25); background: rgba(239, 68, 68, 0.05); font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; border-radius: 8px; cursor: pointer; transition: var(--transition-smooth);">
          <i class="fa-regular fa-trash-can"></i> Excluir do Grupo
        </button>
      `;
    }

    const card = document.createElement("div");
    card.className = "card member-card";
    card.innerHTML = `
      <img class="member-avatar-lg" src="${m.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&q=80'}" alt="${m.name}">
      <h3>${m.name}</h3>
      <span class="member-instrument-label">${m.instrument}</span>
      <div class="member-contacts">
        <div><i class="fa-regular fa-envelope"></i> ${m.email || 'Não cadastrado'}</div>
        <div><i class="fa-solid fa-phone"></i> ${m.phone || 'Não cadastrado'}</div>
      </div>
      
      <div class="member-attendance-panel">
        <div style="display: flex; justify-content: space-between; font-weight: 600;">
          <span>Assiduidade</span>
          <span style="color: ${attendanceRate >= 80 ? 'var(--color-success)' : attendanceRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'}">${attendanceRate}%</span>
        </div>
        <div class="member-attendance-bar">
          <div class="member-attendance-fill" style="width: ${attendanceRate}%;"></div>
        </div>
        <div class="text-secondary" style="font-size: 0.75rem;">
          Escalado em <strong>${totalScaled}</strong> eventos (Presente: ${confirmedCount})
        </div>
        ${reasonsHtml}
      </div>
      ${deleteBtnHtml}
    `;
    container.appendChild(card);
  });
}

// Função de exclusão de membros para Administradores
function excluirMembro(memberId) {
  const targetMember = members.find(m => m.id === memberId);
  if (!targetMember) return;

  if (confirm(`Tem certeza que deseja excluir ${targetMember.name} do grupo? Essa ação é permanente e revogará os acessos dele ao portal.`)) {
    // 1. Remove da lista de membros
    members = members.filter(m => m.id !== memberId);
    localStorage.setItem("cca_members", JSON.stringify(members));

    // 2. Remove da lista de usuários logáveis
    let users = JSON.parse(localStorage.getItem("cca_users")) || [];
    users = users.filter(u => u.memberId !== memberId);
    localStorage.setItem("cca_users", JSON.stringify(users));

    // 3. Remove de todas as escalas ativas de eventos
    events.forEach(ev => {
      ev.team = ev.team.filter(t => t.memberId !== memberId);
      if (ev.presences && ev.presences[memberId]) {
        delete ev.presences[memberId];
      }
    });
    localStorage.setItem("cca_events", JSON.stringify(events));

    // Recarrega o estado do sistema e as telas
    loadData();
    setupUserSelector();
    renderMembros();
    renderDashboard();
    
    alert(`${targetMember.name} foi removido com sucesso.`);
  }
}

// ================= LÓGICA DE ESCALA E PRESENÇA =================

function setPresence(eventId, memberId, status, reason = "") {
  const ev = events.find(e => e.id === eventId);
  if (ev) {
    ev.presences[memberId] = { status, reason };
    saveData("cca_events", events);
  }
}

function triggerAbsenceModal(eventId, memberId) {
  document.getElementById("absence-event-id").value = eventId;
  document.getElementById("absence-member-id").value = memberId;
  document.getElementById("absence-custom-reason").value = "";
  document.getElementById("absence-select-reason").selectedIndex = 0;
  toggleCustomAbsenceInput();
  openModal("modal-absence-reason");
}

function toggleCustomAbsenceInput() {
  const select = document.getElementById("absence-select-reason");
  const group = document.getElementById("custom-absence-group");
  if (select.value === "Outro") {
    group.classList.remove("hidden");
    document.getElementById("absence-custom-reason").required = true;
  } else {
    group.classList.add("hidden");
    document.getElementById("absence-custom-reason").required = false;
  }
}

// ================= TRANSPOSTER & CIFRA VIEWER =================

function openCifraViewer(songId) {
  const song = songs.find(s => s.id === songId);
  if (!song) return;

  currentViewingSong = song;
  currentKeyOffset = 0;
  currentFontSize = 18;
  
  // Preenche dados
  document.getElementById("view-song-title").textContent = song.title;
  document.getElementById("view-song-artist").textContent = song.artist;
  document.getElementById("view-song-rhythm").textContent = song.rhythm;
  document.getElementById("current-key-display").textContent = song.key;
  
  renderParsedCifra();

  document.getElementById("cifra-viewer-overlay").classList.add("active");
  document.body.style.overflow = "hidden"; // trava rolagem do body
}

function closeCifraViewer() {
  stopAutoScroll();
  document.getElementById("cifra-viewer-overlay").classList.remove("active");
  document.body.style.overflow = ""; // restaura rolagem
}

// Parser: Alinha os acordes transpostos por cima da letra exatamente como o Cifra Clube faz
function renderParsedCifra() {
  if (!currentViewingSong) return;

  const rawChords = currentViewingSong.chords;
  const pre = document.getElementById("cifra-sheet-rendered");
  pre.style.fontSize = `${currentFontSize}px`;

  const lines = rawChords.split("\n");
  let outputHtml = "";

  lines.forEach(line => {
    // Linha vazia
    if (line.trim() === "") {
      outputHtml += "<div style='height: 1rem;'></div>";
      return;
    }

    let chordsInLine = [];
    let offsetAdjustment = 0;
    
    // Expressão regular para encontrar os colchetes contendo acordes: [Acorde]
    const regex = /\[([^\]]+)\]/g;
    let match;

    while ((match = regex.exec(line)) !== null) {
      const chordText = match[1];
      const transposed = transposeChord(chordText, currentKeyOffset);
      const indexInCleanLine = match.index - offsetAdjustment;
      
      chordsInLine.push({
        chord: transposed,
        index: indexInCleanLine
      });
      
      offsetAdjustment += match[0].length;
    }

    // Cria a linha limpa de texto de letra de música
    const cleanLine = line.replace(/\[([^\]]+)\]/g, "");

    if (chordsInLine.length > 0) {
      let chordsLine = "";
      let lastPos = 0;
      
      chordsInLine.forEach(item => {
        const spacesToInsert = item.index - lastPos;
        if (spacesToInsert > 0) {
          chordsLine += " ".repeat(spacesToInsert);
        }
        chordsLine += `<span class="chord">${item.chord}</span>`;
        lastPos = item.index + item.chord.length;
      });
      
      outputHtml += `<div class="cifra-row"><div class="chords-line">${chordsLine}</div><div class="lyrics-line">${cleanLine}</div></div>`;
    } else {
      // Se for título de refrão ou cabeçalho estrutural
      if (line.includes("Refrão:") || line.includes("Intro:") || line.includes("Solo:") || line.includes("Ponte:") || line.toLowerCase().includes("refrão") || line.toLowerCase().includes("intro")) {
        outputHtml += `<div class="cifra-section-header">${line}</div>`;
      } else {
        outputHtml += `<div class="lyrics-line">${cleanLine}</div>`;
      }
    }
  });

  pre.innerHTML = outputHtml;
}

// Transpõe um acorde individual (ex: G, Am, C#m7, D/F#)
function transposeChord(chord, offset) {
  if (offset === 0) return chord;

  // Trata acordes com barra (Ex: G/B)
  if (chord.includes("/")) {
    const parts = chord.split("/");
    return transposeChord(parts[0], offset) + "/" + transposeChord(parts[1], offset);
  }

  // Acha a nota raiz do acorde (primeiras letras antes de m, 7, sus, etc.)
  let root = chord[0];
  let restIndex = 1;

  if (chord[1] === "#" || chord[1] === "b") {
    root += chord[1];
    restIndex = 2;
  }

  // Normaliza bemóis
  if (FLATS_MAP[root]) {
    root = FLATS_MAP[root];
  }

  const rootIndex = CHORDS_SCALE.indexOf(root);
  if (rootIndex === -1) return chord; // Se não for acorde reconhecido, retorna original

  let newIndex = (rootIndex + offset) % 12;
  if (newIndex < 0) newIndex += 12;

  const newRoot = CHORDS_SCALE[newIndex];
  const rest = chord.slice(restIndex);

  return newRoot + rest;
}

function changeKey(semitones) {
  currentKeyOffset += semitones;
  
  // Atualiza o tom exibido
  if (currentViewingSong) {
    const origKey = currentViewingSong.key;
    const newKey = transposeChord(origKey, currentKeyOffset);
    document.getElementById("current-key-display").textContent = newKey;
  }
  
  renderParsedCifra();
}

function resetKey() {
  currentKeyOffset = 0;
  if (currentViewingSong) {
    document.getElementById("current-key-display").textContent = currentViewingSong.key;
  }
  renderParsedCifra();
}

// Lógica de Auto-Rolagem
function toggleAutoScroll(speed) {
  stopAutoScroll();

  const bodyElement = document.getElementById("cifra-pre-body");
  const delay = speed === 1 ? 55 : 30; // milissegundos por pixel

  document.getElementById("btn-scroll-slow").classList.add("btn-outline");
  document.getElementById("btn-scroll-fast").classList.add("btn-outline");
  if (speed === 1) document.getElementById("btn-scroll-slow").classList.remove("btn-outline");
  if (speed === 2) document.getElementById("btn-scroll-fast").classList.remove("btn-outline");

  document.getElementById("btn-scroll-stop").classList.remove("hidden");

  autoScrollInterval = setInterval(() => {
    bodyElement.scrollTop += 1;
    // Se bater no fundo, cancela
    if (bodyElement.scrollTop + bodyElement.clientHeight >= bodyElement.scrollHeight - 1) {
      stopAutoScroll();
    }
  }, delay);
}

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
  document.getElementById("btn-scroll-slow").classList.add("btn-outline");
  document.getElementById("btn-scroll-fast").classList.add("btn-outline");
  document.getElementById("btn-scroll-stop").classList.add("hidden");
}

function adjustFontSize(dir) {
  currentFontSize = Math.max(12, Math.min(28, currentFontSize + (dir * 2)));
  document.getElementById("cifra-sheet-rendered").style.fontSize = `${currentFontSize}px`;
}

// ================= MODAIS & LIGHTBOX CONTROLS =================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    
    // Se for o modal de criar evento, pré-carrega listas de músicas e integrantes
    if (modalId === "modal-add-event") {
      populateEventFormHelpers();
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
}

// Popula ajudantes do form de evento
function populateEventFormHelpers() {
  // Lista de músicas com checkbox
  const songsContainer = document.getElementById("event-songs-checkboxes");
  songsContainer.innerHTML = "";
  songs.forEach(s => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" name="event-songs-checkbox" value="${s.id}"> ${s.title} (${s.artist})`;
    songsContainer.appendChild(label);
  });

  // Lista de escalados
  const scaleContainer = document.getElementById("event-team-selector");
  scaleContainer.innerHTML = "";
  members.forEach(m => {
    const row = document.createElement("div");
    row.className = "scale-selector-row";
    row.innerHTML = `
      <label>
        <input type="checkbox" name="event-member-checkbox" value="${m.id}">
        ${m.name}
      </label>
      <select name="event-member-role-${m.id}">
        <option value="${m.instrument}">${m.instrument}</option>
        <option value="Vocal">Vocal</option>
        <option value="Violão">Violão</option>
        <option value="Teclado">Teclado</option>
        <option value="Baixo">Baixo</option>
        <option value="Guitarra">Guitarra</option>
        <option value="Bateria">Bateria</option>
        <option value="Backing Vocal">Backing Vocal</option>
      </select>
    `;
    scaleContainer.appendChild(row);
  });
}

function togglePhotoInput() {
  const type = document.getElementById("photo-url-type").value;
  const urlGroup = document.getElementById("photo-url-group");
  const fileGroup = document.getElementById("photo-file-group");

  if (type === "url") {
    urlGroup.classList.remove("hidden");
    fileGroup.classList.add("hidden");
    document.getElementById("photo-url").required = true;
    document.getElementById("photo-file").required = false;
  } else {
    urlGroup.classList.add("hidden");
    fileGroup.classList.remove("hidden");
    document.getElementById("photo-url").required = false;
    document.getElementById("photo-file").required = true;
  }
}

// Formulários Submit Handlers
function setupForms() {
  // 1. Criar Evento
  document.getElementById("form-add-event").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("event-title").value;
    const type = document.getElementById("event-type").value;
    const date = document.getElementById("event-date").value;
    const time = document.getElementById("event-time").value;
    const arrivalTime = document.getElementById("event-arrival").value;
    const dressCode = document.getElementById("event-dress").value;
    const colorsHexInput = document.getElementById("event-colors-hex").value;
    
    const dressColors = colorsHexInput ? colorsHexInput.split(",").map(c => c.trim()) : [];
    
    // Músicas selecionadas
    const checkedSongs = Array.from(document.querySelectorAll("input[name='event-songs-checkbox']:checked")).map(el => el.value);
    
    // Time escalado
    const checkedMembers = Array.from(document.querySelectorAll("input[name='event-member-checkbox']:checked")).map(el => {
      const memberId = el.value;
      const role = document.querySelector(`select[name='event-member-role-${memberId}']`).value;
      return { memberId, role };
    });

    const newEvent = {
      id: "e" + (events.length + 1) + "_" + Date.now(),
      title,
      type,
      date,
      time,
      arrivalTime,
      dressCode,
      dressColors,
      songs: checkedSongs,
      team: checkedMembers,
      presences: {}
    };

    // Preenche presences vazias/pendentes
    newEvent.team.forEach(t => {
      newEvent.presences[t.memberId] = { status: "pending", reason: "" };
    });

    events.push(newEvent);
    saveData("cca_events", events);
    closeModal("modal-add-event");
    e.target.reset();

    // Constrói mensagem automatizada para envio via WhatsApp Click-to-Chat
    let msg = `*📢 NOVA ESCALA CADASTRADA - CCA MUSIC*\n\n`;
    msg += `*Evento:* ${title} (${type})\n`;
    msg += `*Data:* ${formatDateShort(date)}\n`;
    msg += `*Horário:* ${time}h (Chegada: *${arrivalTime}h*)\n`;
    msg += `*Paleta de Roupas:* ${dressCode || 'Livre'}\n\n`;
    
    msg += `*👥 INTEGRANTES ESCALADOS:*\n`;
    checkedMembers.forEach(item => {
      const m = members.find(member => member.id === item.memberId);
      if (m) {
        msg += `- *${m.nickname || m.name.split(" ")[0]}:* ${item.role}\n`;
      }
    });
    
    if (checkedSongs.length > 0) {
      msg += `\n*🎸 REPERTÓRIO:*\n`;
      checkedSongs.forEach((songId, index) => {
        const s = songs.find(song => song.id === songId);
        if (s) {
          msg += `${index + 1}. *${s.title}* (${s.artist})\n`;
        }
      });
    }
    
    msg += `\n_Acesse o portal para confirmar sua presença!_`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    
    setTimeout(() => {
      if (confirm("Evento cadastrado com sucesso! Deseja enviar o aviso completo da escala no WhatsApp do grupo?")) {
        window.open(whatsappUrl, "_blank");
      }
    }, 100);
  });

  // 2. Adicionar Música
  document.getElementById("form-add-song").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("song-title").value;
    const artist = document.getElementById("song-artist").value;
    const key = document.getElementById("song-key").value;
    const rhythm = document.getElementById("song-rhythm").value;
    const tagsInput = document.getElementById("song-tags").value;
    const chords = document.getElementById("song-chords").value;

    const tags = tagsInput ? tagsInput.split(",").map(t => t.trim()) : ["Geral"];

    const newSong = {
      id: "s" + (songs.length + 1) + "_" + Date.now(),
      title,
      artist,
      key,
      rhythm,
      tags,
      chords
    };

    songs.push(newSong);
    saveData("cca_songs", songs);
    closeModal("modal-add-song");
    e.target.reset();
  });

  // 3. Adicionar Foto (suporta File Upload como Base64)
  document.getElementById("form-add-photo").addEventListener("submit", (e) => {
    e.preventDefault();
    const caption = document.getElementById("photo-caption").value;
    const type = document.getElementById("photo-url-type").value;
    
    if (type === "url") {
      const url = document.getElementById("photo-url").value;
      const newPhoto = { id: "p" + (photos.length + 1) + "_" + Date.now(), url, caption };
      photos.unshift(newPhoto);
      saveData("cca_photos", photos);
      closeModal("modal-add-photo");
      e.target.reset();
    } else {
      const fileInput = document.getElementById("photo-file");
      if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const newPhoto = {
            id: "p" + (photos.length + 1) + "_" + Date.now(),
            url: event.target.result, // base64 string
            caption
          };
          photos.unshift(newPhoto);
          saveData("cca_photos", photos);
          closeModal("modal-add-photo");
          e.target.reset();
        };
        reader.readAsDataURL(fileInput.files[0]);
      }
    }
  });

  // 4. Cadastrar Integrante
  document.getElementById("form-add-member").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("member-name").value;
    const instrument = document.getElementById("member-instrument").value;
    const email = document.getElementById("member-email").value;
    const phone = document.getElementById("member-phone").value;
    const role = document.getElementById("member-role").value;
    const photo = document.getElementById("member-photo").value;

    const newMember = {
      id: "m" + (members.length + 1) + "_" + Date.now(),
      name,
      instrument,
      email,
      phone,
      role,
      photo: photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&q=80"
    };

    members.push(newMember);
    saveData("cca_members", members);
    setupUserSelector(); // re-popula seletor
    closeModal("modal-add-member");
    e.target.reset();
  });

  // 5. Justificar Falta
  document.getElementById("form-absence-reason").addEventListener("submit", (e) => {
    e.preventDefault();
    const eventId = document.getElementById("absence-event-id").value;
    const memberId = document.getElementById("absence-member-id").value;
    const preReason = document.getElementById("absence-select-reason").value;
    const customReason = document.getElementById("absence-custom-reason").value;
    
    const finalReason = preReason === "Outro" ? customReason : preReason;
    
    setPresence(eventId, memberId, "declined", finalReason);
    closeModal("modal-absence-reason");
  });
}

// Lightbox
function openLightbox(url, caption) {
  document.getElementById("lightbox-img").src = url;
  document.getElementById("lightbox-caption").textContent = caption;
  document.getElementById("lightbox").style.display = "flex";
}
function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
}

// Formatação Utilitária de Datas
function formatDateShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const options = { day: 'numeric', month: 'short' };
  return d.toLocaleDateString('pt-BR', options).replace(".","");
}

// Pesquisa Direta no Cifra Club (Busca Cantor ou Música)
function searchOnCifraClub() {
  const query = document.getElementById("search-cifras").value.trim();
  if (!query) {
    alert("Por favor, digite o nome da música ou do cantor no campo de busca para pesquisar no Cifra Club.");
    return;
  }
  const url = `https://www.cifraclub.com.br/?q=${encodeURIComponent(query)}`;
  window.open(url, "_blank");
}

// Lógica de Login e Cadastro (Auth Portal)
function toggleAuthForms(mode) {
  const loginCard = document.getElementById("auth-login-card");
  const registerCard = document.getElementById("auth-register-card");
  
  if (mode === "register") {
    loginCard.classList.add("hidden");
    registerCard.classList.remove("hidden");
  } else {
    loginCard.classList.remove("hidden");
    registerCard.classList.add("hidden");
  }
}

function setupAuthForms() {
  // Conversão de foto de perfil em Base64
  let selectedPhotoBase64 = "";
  const photoInput = document.getElementById("register-photo");
  if (photoInput) {
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          selectedPhotoBase64 = event.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        selectedPhotoBase64 = "";
      }
    });
  }

  // Controle dinâmico do código de administrador no cadastro
  const accessSelect = document.getElementById("register-access");
  if (accessSelect) {
    const codeGroup = document.getElementById("register-admin-code-group");
    const codeInput = document.getElementById("register-admin-code");
    accessSelect.addEventListener("change", (e) => {
      if (e.target.value === "Administrador") {
        codeGroup.classList.remove("hidden");
        codeInput.setAttribute("required", "true");
      } else {
        codeGroup.classList.add("hidden");
        codeInput.removeAttribute("required");
        codeInput.value = "";
      }
    });
  }

  // Login Form submit
  document.getElementById("form-auth-login").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    const errorMsg = document.getElementById("login-error-msg");

    const users = JSON.parse(localStorage.getItem("cca_users")) || [];
    const matched = users.find(u => u.email === email && u.password === password);

    if (matched) {
      errorMsg.classList.add("hidden");
      localStorage.setItem("cca_auth_token", matched.email);
      localStorage.setItem("cca_current_member", matched.memberId);
      currentUserId = matched.memberId;
      
      checkAuth();
      setupUserSelector();
      renderActiveView();
      e.target.reset();
    } else {
      errorMsg.classList.remove("hidden");
    }
  });

  // Register Form submit
  document.getElementById("form-auth-register").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("register-name").value.trim();
    const nickname = document.getElementById("register-nickname").value.trim();
    const instrument = document.getElementById("register-instrument").value.trim();
    const role = document.getElementById("register-role").value;
    const accessLevel = document.getElementById("register-access").value;
    const phone = document.getElementById("register-phone").value.trim();
    
    // Constrói e-mail automático
    const emailUser = document.getElementById("register-email-user").value.trim().toLowerCase();
    const email = emailUser + "@ccamusic.com.br";
    
    const password = document.getElementById("register-password").value;
    const confirm = document.getElementById("register-confirm").value;
    const errorMsg = document.getElementById("register-error-msg");

    // Valida Código de Administrador caso selecionado
    if (accessLevel === "Administrador") {
      const adminCode = document.getElementById("register-admin-code").value.trim();
      if (adminCode.toUpperCase() !== "CCA2026") {
        errorMsg.textContent = "Código de acesso administrador incorreto! Solicite ao líder.";
        errorMsg.classList.remove("hidden");
        return;
      }
    }

    if (password !== confirm) {
      errorMsg.textContent = "As senhas não coincidem!";
      errorMsg.classList.remove("hidden");
      return;
    }

    if (password.length < 4) {
      errorMsg.textContent = "A senha deve conter no mínimo 4 caracteres!";
      errorMsg.classList.remove("hidden");
      return;
    }

    const users = JSON.parse(localStorage.getItem("cca_users")) || [];
    if (users.some(u => u.email === email)) {
      errorMsg.textContent = "Este e-mail de acesso já está cadastrado!";
      errorMsg.classList.remove("hidden");
      return;
    }

    errorMsg.classList.add("hidden");

    // 1. Cria Novo Membro correspondente
    const newMemberId = "m" + (members.length + 1) + "_" + Date.now();
    const newMember = {
      id: newMemberId,
      name,
      nickname: nickname || name.split(" ")[0],
      instrument,
      email,
      phone: phone || "Não informado",
      role: role,
      accessLevel: accessLevel,
      photo: selectedPhotoBase64 || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&q=80"
    };

    members.push(newMember);
    localStorage.setItem("cca_members", JSON.stringify(members));

    // 2. Cria Conta de Usuário
    const newUser = {
      email,
      password,
      memberId: newMemberId,
      accessLevel: accessLevel
    };
    users.push(newUser);
    localStorage.setItem("cca_users", JSON.stringify(users));

    // 3. Autenticação e Login Automático
    localStorage.setItem("cca_auth_token", email);
    localStorage.setItem("cca_current_member", newMemberId);
    currentUserId = newMemberId;

    loadData();
    checkAuth();
    setupUserSelector();
    renderActiveView();
    
    // Reseta o formulário e esconde o campo do código de administrador
    e.target.reset();
    selectedPhotoBase64 = ""; // Reseta imagem base64
    const codeGroup = document.getElementById("register-admin-code-group");
    if (codeGroup) codeGroup.classList.add("hidden");

    // 4. Aviso automático via WhatsApp: Novo membro cadastrado
    let msg = `*🎵 NOVO INTEGRANTE - CCA MUSIC*\n\n`;
    msg += `*Nome:* ${name}\n`;
    msg += `*Apelido:* ${nickname || name.split(" ")[0]}\n`;
    msg += `*Instrumento:* ${instrument}\n`;
    msg += `*Função:* ${role}\n`;
    msg += `*Telefone:* ${phone || 'Não informado'}\n`;
    msg += `*Nível:* ${accessLevel}\n\n`;
    msg += `_Bem-vindo(a) ao grupo! 🙌_`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    setTimeout(() => {
      if (confirm(`${name} foi cadastrado(a) com sucesso! Deseja enviar o aviso de boas-vindas no WhatsApp do grupo?`)) {
        window.open(whatsappUrl, "_blank");
      }
    }, 100);
  });
}

function logoutUser() {
  localStorage.removeItem("cca_auth_token");
  checkAuth();
  stopAutoScroll();
  closeCifraViewer();
}