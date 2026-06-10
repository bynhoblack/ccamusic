// Portal CCA Music - Lógica de Negócios e Integração Supabase Nativa
// =====================================================================

// Configurações de Conexão com o Supabase
const SUPABASE_URL = "https://ldsyjywdufhrblncadvj.supabase.co";
const SUPABASE_KEY = "sb_publishable_oxkG6V8AV2YFrRVRc-Bygg_hHrbwKyV";

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
      fetch(`${SUPABASE_URL}/rest/v1/songs?order=title.asc`, { headers: getHeaders() }),
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

      const presenceInfo = nextEvent.presences[m.id] || { status: "pending", reason: "" };
      let statusClass = "pending", statusIcon = '<i class="fa-regular fa-clock"></i>', statusText = "Pendente", tooltip = "";

      if (presenceInfo.status === "confirmed") {
        statusClass = "confirmed"; statusIcon = '<i class="fa-solid fa-check"></i>'; statusText = "Confirmado";
      } else if (presenceInfo.status === "declined") {
        statusClass = "declined"; statusIcon = '<i class="fa-solid fa-xmark"></i>'; statusText = "Ausente";
        tooltip = `title="Justificativa: ${presenceInfo.reason || 'Não informada'}"`;
      }

      const li = document.createElement("li");
      li.className = "scale-member-item";
      li.innerHTML = `
        <div class="scale-member-left">
          <img class="scale-member-avatar" src="${m.photo_url || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" alt="${m.name}">
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
  }

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
    songsList.innerHTML = "<p class='text-secondary font-sm'>Nenhuma música vinculada a este dia.</p>";
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
      </div>
    `;
    return;
  }

  events.forEach(ev => {
    let conf = 0, dec = 0, pend = 0;
    if(ev.team) {
        ev.team.forEach(t => {
          const pres = ev.presences[t.memberId] ? ev.presences[t.memberId].status : "pending";
          if (pres === "confirmed") conf++;
          else if (pres === "declined") dec++;
          else pend++;
        });
    }

    const isEnsaio = ev.type.toLowerCase().includes("ensaio");
    let dotsHtml = "";
    if (ev.dress_colors) {
      ev.dress_colors.forEach(c => {
        dotsHtml += `<div class="color-dot" style="background-color: ${c.trim()};" title="${c.trim()}"></div>`;
      });
    }

    const card = document.createElement("div");
    card.className = `card event-card ${isEnsaio ? 'card-ensaio' : ''}`;
    
    let scaleBadges = "";
    if(ev.team) {
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
    }

    let songsTags = "";
    if(ev.songs) {
        ev.songs.forEach(songId => {
          const s = songs.find(song => song.id === songId);
          if (s) {
            songsTags += `<span class="song-tag cifra-link" onclick="event.stopPropagation(); openCifraViewer('${s.id}')"><i class="fa-solid fa-guitar"></i> ${s.title}</span>`;
          }
        });
    }

    card.innerHTML = `
      <div class="event-card-header">
        <span class="event-type-tag">${ev.type}</span>
        <span class="event-date-badge"><i class="fa-regular fa-calendar"></i> ${formatDateShort(ev.date)}</span>
      </div>
      <div class="event-card-body">
        <h3>${ev.title}</h3>
        <div class="event-meta-block">
          <div><i class="fa-regular fa-clock"></i> Início: <strong>${ev.time.substring(0,5)}h</strong> (Chegada: ${ev.arrival_time.substring(0,5)}h)</div>
          <div><i class="fa-solid fa-shirt"></i> Roupas: <strong>${ev.dress_code || 'Livre'}</strong></div>
          <div class="color-palette-preview">${dotsHtml}</div>
        </div>
        <div class="event-scale-preview">
          <h4>Integrantes (${conf} Confirmados, ${dec} Ausentes)</h4>
          <div class="scale-members-flex">${scaleBadges || '<span class="text-secondary">Ninguém escalado</span>'}</div>
        </div>
        <div class="event-scale-preview">
          <h4>Repertório</h4>
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
                          (s.tags && s.tags.some(t => t.toLowerCase().includes(searchQuery)));
    const matchesRhythm = !rhythmFilter || s.rhythm === rhythmFilter;
    return matchesSearch && matchesRhythm;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align: center; padding: 3rem;"><h3>Nenhuma cifra encontrada</h3></div>`;
    return;
  }

  filtered.forEach(s => {
    const card = document.createElement("div");
    card.className = "card cifra-card";
    card.onclick = () => openCifraViewer(s.id);

    let tagsHtml = "";
    if(s.tags) {
        s.tags.forEach(t => { tagsHtml += `<span class="song-tag">${t}</span>`; });
    }

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
    container.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align: center; padding: 3rem; width: 100%;"><h3>Galeria vazia</h3></div>`;
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

  const currentUser = members.find(member => member.id === currentUserId);
  const accessLevel = currentUser ? (currentUser.access_level || "Membro") : "Membro";

  members.forEach(m => {
    let totalScaled = 0, confirmedCount = 0, absenceReasons = [];

    events.forEach(ev => {
      const isScaled = ev.team && ev.team.some(t => t.memberId === m.id);
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
    
    let reasonsHtml = "";
    if (absenceReasons.length > 0) {
      reasonsHtml += `<div class="member-absence-reasons-list">
        <h5>Faltas Justificadas:</h5>
        ${absenceReasons.map(r => `<div><strong>${r.date}:</strong> ${r.reason} (${r.eventTitle})</div>`).join("")}
      </div>`;
    }

    let deleteBtnHtml = "";
    if (accessLevel === "Administrador" && m.id !== currentUserId) {
      deleteBtnHtml = `
        <button class="btn btn-secondary text-danger" onclick="excluirMembro('${m.id}')" style="margin-top: 1rem; width: 100%; border-color: rgba(239, 68, 68, 0.25); background: rgba(239, 68, 68, 0.05); font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; border-radius: 8px; cursor: pointer;">
          <i class="fa-regular fa-trash-can"></i> Excluir do Grupo
        </button>
      `;
    }

    const card = document.createElement("div");
    card.className = "card member-card";
    card.innerHTML = `
      <img class="member-avatar-lg" src="${m.photo_url || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" alt="${m.name}">
      <h3>${m.name}</h3>
      <span class="member-instrument-label">${m.instrument}</span>
      <div class="member-contacts">
        <div><i class="fa-regular fa-envelope"></i> ${m.email}</div>
        <div><i class="fa-solid fa-phone"></i> ${m.phone}</div>
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

// Remoção Completa e Integrada via API REST
async function excluirMembro(memberId) {
  const targetMember = members.find(m => m.id === memberId);
  if (!targetMember) return;

  if (confirm(`Tem certeza que deseja excluir ${targetMember.name} do grupo?`)) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${memberId}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      alert(`${targetMember.name} foi removido com sucesso.`);
      await loadData();
    } catch (e) {
      alert("Erro ao remover integrante.");
    }
  }
}

// ================= LÓGICA DE EVENTOS E PRESENÇA =================

async function setPresence(eventId, memberId, status, reason = "") {
  const body = {
    event_id: eventId,
    member_id: memberId,
    status: status,
    reason: reason,
    updated_at: new Date().toISOString()
  };

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/presences`, {
      method: "POST",
      headers: { ...getHeaders(), "On-Conflict": "event_id,member_id" },
      body: JSON.stringify(body)
    });
    closeModal("modal-absence-reason");
    await loadData();
  } catch (err) {
    console.error(err);
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
  originalSongChords = song.chords;
  currentKeyOffset = 0;
  currentFontSize = 18;
  
  document.getElementById("view-song-title").textContent = song.title;
  document.getElementById("view-song-artist").textContent = song.artist;
  document.getElementById("view-song-rhythm").textContent = song.rhythm;
  document.getElementById("current-key-display").textContent = song.key;
  
  renderParsedCifra();
  document.getElementById("cifra-viewer-overlay").classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCifraViewer() {
  stopAutoScroll();
  document.getElementById("cifra-viewer-overlay").classList.remove("active");
  document.body.style.overflow = "";
}

function renderParsedCifra() {
  if (!currentViewingSong) return;
  const output = originalSongChords.replace(/\[(.*?)\]/g, '<span class="chord-highlight">$1</span>');
  document.getElementById("cifra-sheet-rendered").innerHTML = output;
}

function changeKey(direction) {
  currentKeyOffset += direction;
  const notas = CHORDS_SCALE;
  
  const transposed = originalSongChords.replace(/\[(.*?)\]/g, (match, chord) => {
    let baseNota = chord.match(/^[A-G]#?/)?.[0];
    if (!baseNota) return match;
    
    let rest = chord.substring(baseNota.length);
    let idx = notas.indexOf(baseNota);
    if(idx === -1) return match;

    let newIdx = (idx + direction) % 12;
    if(newIdx < 0) newIdx += 12;
    
    return `[${notas[newIdx]}${rest}]`;
  });

  originalSongChords = transposed;
  renderParsedCifra();
}

function toggleAutoScroll(speed) {
  stopAutoScroll();
  const viewerBody = document.getElementById("cifra-pre-body");
  if(!viewerBody) return;
  let intervalTime = speed === 1 ? 50 : 30;

  const stopBtn = document.getElementById("btn-scroll-stop");
  if(stopBtn) stopBtn.classList.remove("hidden");

  autoScrollInterval = setInterval(() => {
    viewerBody.scrollTop += 1;
    if (viewerBody.scrollTop + viewerBody.clientHeight >= viewerBody.scrollHeight) {
      stopAutoScroll();
    }
  }, intervalTime);
}

function stopAutoScroll() {
  clearInterval(autoScrollInterval);
  const stopBtn = document.getElementById("btn-scroll-stop");
  if(stopBtn) stopBtn.classList.add("hidden");
}

function adjustFontSize(dir) {
  currentFontSize += dir;
  const pre = document.getElementById("cifra-sheet-rendered");
  if(pre) pre.style.fontSize = currentFontSize + 'px';
}

// ================= FORMULÁRIOS E CADASTROS (INSERT) =================

function setupForms() {
  // Envio de Cifras
  document.getElementById("form-add-song").onsubmit = async (e) => {
    e.preventDefault();
    const tagsArr = document.getElementById("song-tags").value.split(",").map(t => t.trim()).filter(t => t !== "");
    const body = {
      title: document.getElementById("song-title").value.trim(),
      artist: document.getElementById("song-artist").value.trim(),
      key: document.getElementById("song-key").value,
      rhythm: document.getElementById("song-rhythm").value.trim(),
      tags: tagsArr,
      chords: document.getElementById("song-chords").value
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/songs`, {
      method: "POST", headers: getHeaders(), body: JSON.stringify(body)
    });
    if(res.ok) {
      closeModal('modal-add-song');
      document.getElementById("form-add-song").reset();
      await loadData();
    }
  };

  // Envio de Fotos
  document.getElementById("form-add-photo").onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      caption: document.getElementById("photo-caption").value.trim(),
      url: document.getElementById("photo-url").value.trim()
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/photos`, {
      method: "POST", headers: getHeaders(), body: JSON.stringify(body)
    });
    if(res.ok) {
      closeModal('modal-add-photo');
      document.getElementById("form-add-photo").reset();
      await loadData();
    }
  };

  // Envio de Ausências Justificadas
  document.getElementById("form-absence-reason").onsubmit = (e) => {
    e.preventDefault();
    const eventId = document.getElementById("absence-event-id").value;
    const memberId = document.getElementById("absence-member-id").value;
    const sel = document.getElementById("absence-select-reason").value;
    const cust = document.getElementById("absence-custom-reason").value.trim();
    const reason = sel === "Outro" ? cust : sel;

    setPresence(eventId, memberId, "declined", reason);
  };

  // Envio de Novo Evento / Escala
  document.getElementById("form-add-event").onsubmit = async (e) => {
    e.preventDefault();
    
    // Captura opcional de checkboxes e times (conforme estruturado em seu HTML)
    const boxes = document.querySelectorAll(".song-checkbox-item:checked");
    const songIds = Array.from(boxes).map(b => b.value);

    const rows = document.querySelectorAll(".scale-selector-row");
    const team = Array.from(rows).map(row => {
      const sel = row.querySelector(".select-team-member");
      const rInput = row.querySelector(".input-team-role");
      return { memberId: sel.value, memberName: sel.options[sel.selectedIndex].text, role: rInput.value.trim() };
    }).filter(t => t.memberId !== "");

    const colorsInput = document.getElementById("event-colors-hex")?.value;
    const colorsArray = colorsInput ? colorsInput.split(",").map(c => c.trim()) : [];

    const body = {
      title: document.getElementById("event-title").value.trim(),
      type: document.getElementById("event-type").value,
      date: document.getElementById("event-date").value,
      time: document.getElementById("event-time").value,
      arrival_time: document.getElementById("event-arrival").value,
      dress_code: document.getElementById("event-dress").value.trim(),
      dress_colors: colorsArray,
      songs: songIds,
      team: team
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST", headers: getHeaders(), body: JSON.stringify(body)
    });
    if(res.ok) {
      closeModal('modal-add-event');
      document.getElementById("form-add-event").reset();
      await loadData();
    }
  };
}

// ================= INTERFACE DE AUTENTICAÇÃO =================

function setupAuthForms() {
  const accessSelect = document.getElementById("register-access");
  if (accessSelect) {
    accessSelect.onchange = (e) => {
      const group = document.getElementById("register-admin-code-group");
      if (e.target.value === "Administrador") group.classList.remove("hidden");
      else group.classList.add("hidden");
    };
  }

  // Formulário de login
  document.getElementById("form-auth-login").onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;
    const err = document.getElementById("login-error-msg");

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(pass)}`, {
      method: "GET", headers: getHeaders()
    });
    const data = await res.json();

    if (data && data.length > 0) {
      localStorage.setItem("cca_user", JSON.stringify(data[0]));
      err.classList.add("hidden");
      currentUserId = data[0].id;
      document.getElementById("auth-screen-overlay").classList.remove("active");
      await loadData();
    } else {
      err.textContent = "Usuário ou senha incorretos!";
      err.classList.remove("hidden");
    }
  };

  // Formulário de Cadastro
  document.getElementById("form-auth-register").onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById("register-error-msg");
    const pass = document.getElementById("register-password").value;
    const conf = document.getElementById("register-confirm").value;
    const access = document.getElementById("register-access").value;

    if (pass !== conf) {
      err.textContent = "As senhas não coincidem!";
      err.classList.remove("hidden");
      return;
    }

    if (access === "Administrador" && document.getElementById("register-admin-code").value !== ADMIN_SECURITY_CODE) {
      err.textContent = "Código de segurança inválido!";
      err.classList.remove("hidden");
      return;
    }

    const emailPrefix = document.getElementById("register-email-user").value.trim();
    const body = {
      name: document.getElementById("register-name").value.trim(),
      nickname: document.getElementById("register-nickname").value.trim(),
      instrument: document.getElementById("register-instrument").value.trim(),
      role: document.getElementById("register-role").value,
      access_level: access,
      email: `${emailPrefix}@ccamusic.com.br`,
      phone: document.getElementById("register-phone").value.trim(),
      password: pass,
      photo_url: ""
    };

    const res = await fetch('https://ldsyjywdufhrblncadvj.supabase.co/rest/v1/members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3lqeXdkdWZocmJsbmNhZHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTM5ODMsImV4cCI6MjA5NjU4OTk4M30.9CO7Jziy-VItNFlpDGKlkrV6f_DPXwmq-Mdu5rRYaCk',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3lqeXdkdWZocmJsbmNhZHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTM5ODMsImV4cCI6MjA5NjU4OTk4M30.9CO7Jziy-VItNFlpDGKlkrV6f_DPXwmq-Mdu5rRYaCk',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const created = await res.json();
      localStorage.setItem("cca_user", JSON.stringify(created[0]));
      document.getElementById("auth-screen-overlay").classList.remove("active");
      await loadData();
    } else {
      err.textContent = "Erro ao registrar conta. E-mail já em uso.";
      err.classList.remove("hidden");
    }
  };
}

function toggleAuthForms(mode) {
  if (mode === 'register') {
    document.getElementById("auth-login-card").classList.add("hidden");
    document.getElementById("auth-register-card").classList.remove("hidden");
  } else {
    document.getElementById("auth-register-card").classList.add("hidden");
    document.getElementById("auth-login-card").classList.remove("hidden");
  }
}

// ================= MODAIS & UTILITÁRIOS VISUAIS =================

function openModal(id) {
  document.getElementById(id).classList.add("active");
  if (id === 'modal-add-event') {
    const containerSongs = document.getElementById("event-songs-checkboxes");
    if(containerSongs) {
      containerSongs.innerHTML = "";
      songs.forEach(s => {
        containerSongs.innerHTML += `<label style="display:block; margin-bottom:4px;"><input type="checkbox" class="song-checkbox-item" value="${s.id}"> ${s.title}</label>`;
      });
    }
    const containerTeam = document.getElementById("event-team-selector");
    if(containerTeam) {
      containerTeam.innerHTML = "";
      for (let i = 0; i < 3; i++) {
        let mOpts = `<option value="">-- Selecione o Integrante --</option>`;
        members.forEach(m => { mOpts += `<option value="${m.id}">${m.nickname}</option>`; });
        containerTeam.innerHTML += `
          <div class="scale-selector-row" style="display:flex; gap:8px; margin-bottom:8px;">
            <select class="select-team-member" style="flex:1; padding:0.4rem;">${mOpts}</select>
            <input type="text" class="input-team-role" placeholder="Função Ex: Bateria" style="flex:1; padding:0.4rem;">
          </div>`;
      }
    }
  }
}

function closeModal(id) { document.getElementById(id).classList.remove("active"); }
function formatDateShort(d) { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.',''); }
function openLightbox(url, cap) { document.getElementById("lightbox-img").src = url; document.getElementById("lightbox-caption").textContent = cap; document.getElementById("lightbox").classList.add("active"); }
function closeLightbox() { document.getElementById("lightbox").classList.remove("active"); }