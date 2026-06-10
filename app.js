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
let currentFontSize = 16; // px
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
    if (Array.isArray(events)) {
      events.forEach(ev => {
        ev.presences = {};
        if (Array.isArray(presencesCache)) {
          const filtradas = presencesCache.filter(p => p.event_id === ev.id);
          filtradas.forEach(p => {
            ev.presences[p.member_id] = { status: p.status, reason: p.reason };
          });
        }
      });
    }

    // Gerencia o Token de Sessão ativa
    const loggedUserJson = localStorage.getItem("cca_user");
    if (loggedUserJson) {
      const savedUser = JSON.parse(loggedUserJson);
      const matched = members.find(m => m.id === savedUser.id);
      if (matched) {
        currentUserId = matched.id;
        setupUserSelector();
        renderActiveView();
        return;
      }
    }

    if (Array.isArray(members) && members.length > 0) {
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
    if (overlay) overlay.classList.add("active");
  } else {
    if (overlay) overlay.classList.remove("active");
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
  const liveDateEl = document.getElementById("live-date");
  if (liveDateEl) liveDateEl.textContent = new Date().toLocaleDateString('pt-BR', options);
}

// Auxiliares de Modais
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
  const lbImg = document.getElementById("lightbox-img");
  const lbCap = document.getElementById("lightbox-caption");
  const lb = document.getElementById("gallery-lightbox");
  if (lbImg) lbImg.src = url;
  if (lbCap) lbCap.textContent = caption;
  if (lb) lb.classList.add("active");
}

function closeLightbox() {
  const lb = document.getElementById("gallery-lightbox");
  if (lb) lb.classList.remove("active");
}

function formatDateShort(dateStr) {
  if(!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

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

function renderDashboard() {
  const songCountEl = document.getElementById("stat-songs-count");
  const memCountEl = document.getElementById("stat-members-count");
  if (songCountEl) songCountEl.textContent = `${songs.length} Músicas`;
  if (memCountEl) memCountEl.textContent = `${members.length} Integrantes`;

  const todayStr = new Date().toISOString().split("T")[0];
  const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  let nextEvent = sortedEvents.find(e => e.date >= todayStr);
  if (!nextEvent && sortedEvents.length > 0) {
    nextEvent = sortedEvents[sortedEvents.length - 1];
  }

  if (!nextEvent) {
    if(document.getElementById("dash-event-title")) document.getElementById("dash-event-title").textContent = "Nenhum evento agendado.";
    if(document.getElementById("stat-next-date")) document.getElementById("stat-next-date").textContent = "Sem Escala";
    return;
  }

  if(document.getElementById("stat-next-date")) document.getElementById("stat-next-date").textContent = formatDateShort(nextEvent.date);
  if(document.getElementById("dash-event-title")) document.getElementById("dash-event-title").textContent = `${nextEvent.title} (${nextEvent.type})`;
  if(document.getElementById("dash-event-time")) document.getElementById("dash-event-time").textContent = `${nextEvent.time.substring(0,5)}h`;
  if(document.getElementById("dash-event-arrival")) document.getElementById("dash-event-arrival").textContent = `${nextEvent.arrival_time.substring(0,5)}h`;
  if(document.getElementById("dash-event-dress")) document.getElementById("dash-event-dress").textContent = nextEvent.dress_code || "Livre";

  const colorsContainer = document.getElementById("dash-event-colors");
  if (colorsContainer) {
    colorsContainer.innerHTML = "";
    if (nextEvent.dress_colors && nextEvent.dress_colors.length > 0) {
      nextEvent.dress_colors.forEach(color => {
        const dot = document.createElement("div");
        dot.className = "color-dot";
        dot.style.backgroundColor = color.trim();
        colorsContainer.appendChild(dot);
      });
    }
  }

  const presenceActions = document.getElementById("dash-presence-actions");
  if (presenceActions) {
    presenceActions.innerHTML = "";
    const isScaled = nextEvent.team && nextEvent.team.some(t => t.memberId === currentUserId);
    const currentPresence = nextEvent.presences ? nextEvent.presences[currentUserId] : null;

    if (!isScaled) {
      presenceActions.innerHTML = `<span class="presence-indicator presence-pending"><i class="fa-solid fa-circle-exclamation"></i> Você não está escalado</span>`;
    } else {
      const status = currentPresence ? currentPresence.status : "pending";
      if (status === "confirmed") {
        presenceActions.innerHTML = `
          <span class="presence-indicator presence-confirmed"><i class="fa-solid fa-circle-check"></i> Presença Confirmada!</span>
          <button class="btn btn-xs btn-danger" onclick="triggerAbsenceModal('${nextEvent.id}', '${currentUserId}')">Alterar para Falta</button>
        `;
      } else if (status === "declined") {
        presenceActions.innerHTML = `
          <span class="presence-indicator presence-declined"><i class="fa-solid fa-circle-xmark"></i> Ausente Justificado</span>
          <button class="btn btn-xs btn-primary" onclick="setPresence('${nextEvent.id}', '${currentUserId}', 'confirmed')">Mudar para Confirmado</button>
        `;
      } else {
        presenceActions.innerHTML = `
          <button class="btn btn-primary btn-xs" onclick="setPresence('${nextEvent.id}', '${currentUserId}', 'confirmed')">Confirmar</button>
          <button class="btn btn-danger btn-xs" onclick="triggerAbsenceModal('${nextEvent.id}', '${currentUserId}')">Recusar</button>
        `;
      }
    }
  }

  const scaleList = document.getElementById("dash-event-scale-list");
  if (scaleList) {
    scaleList.innerHTML = "";
    if(nextEvent.team) {
      nextEvent.team.forEach(t => {
        const m = members.find(member => member.id === t.memberId);
        if (!m) return;
        const presenceInfo = nextEvent.presences ? (nextEvent.presences[m.id] || { status: "pending" }) : { status: "pending" };
        const li = document.createElement("li");
        li.innerHTML = `
          <div><strong>${m.name}</strong><br><span>${t.role}</span></div>
          <span class="presence-indicator presence-${presenceInfo.status}">${presenceInfo.status === 'confirmed' ? 'Confirmado' : presenceInfo.status === 'declined' ? 'Ausente' : 'Pendente'}</span>
        `;
        scaleList.appendChild(li);
      });
    }
  }

  const songsList = document.getElementById("dash-event-songs-list");
  if (songsList) {
    songsList.innerHTML = "";
    if (nextEvent.songs && nextEvent.songs.length > 0) {
      nextEvent.songs.forEach(songId => {
        const s = songs.find(song => song.id === songId);
        if (!s) return;
        const card = document.createElement("div");
        card.className = "song-link-item";
        card.onclick = () => openCifraViewer(s.id);
        card.innerHTML = `<span><strong>${s.title}</strong> - ${s.artist}</span> <i class="fa-solid fa-chevron-right"></i>`;
        songsList.appendChild(card);
      });
    }
  }
}

function renderEscalas() {
  const container = document.getElementById("events-cards-container");
  if (!container) return;
  container.innerHTML = "";

  events.forEach(ev => {
    const card = document.createElement("div");
    card.className = "event-card";
    card.innerHTML = `
      <div class="event-card-header">
        <h3>${ev.title}</h3>
        <span class="song-card-key">${ev.type}</span>
      </div>
      <p><i class="fa-regular fa-calendar"></i> Data: ${formatDateShort(ev.date)}</p>
      <p><i class="fa-regular fa-clock"></i> Início: ${ev.time.substring(0,5)}h</p>
    `;
    container.appendChild(card);
  });
}

function renderCifras() {
  const container = document.getElementById("cifras-cards-container");
  if (!container) return;
  container.innerHTML = "";

  const searchQuery = document.getElementById("search-cifras") ? document.getElementById("search-cifras").value.toLowerCase() : "";

  const filtered = songs.filter(s => s.title.toLowerCase().includes(searchQuery) || s.artist.toLowerCase().includes(searchQuery));
  filtered.forEach(s => {
    const card = document.createElement("div");
    card.className = "song-card";
    card.onclick = () => openCifraViewer(s.id);
    card.innerHTML = `
      <div class="song-card-header">
        <h3>${s.title}</h3>
        <span class="song-card-key">${s.key}</span>
      </div>
      <p class="text-secondary">${s.artist}</p>
      <span class="font-sm" style="color: var(--primary)">${s.rhythm || 'Ritmo não informado'}</span>
    `;
    container.appendChild(card);
  });

  const sInput = document.getElementById("search-cifras");
  if (sInput && !sInput.dataset.hasListener) {
    sInput.addEventListener("input", renderCifras);
    sInput.dataset.hasListener = "true";
  }
}

function renderGaleria() {
  const container = document.getElementById("gallery-container");
  if (!container) return;
  container.innerHTML = "";

  photos.forEach(p => {
    const div = document.createElement("div");
    div.className = "gallery-item";
    div.onclick = () => openLightbox(p.url, p.caption);
    div.innerHTML = `<img src="${p.url}"><div class="gallery-caption">${p.caption}</div>`;
    container.appendChild(div);
  });
}

function renderMembros() {
  const container = document.getElementById("members-container");
  if (!container) return;
  container.innerHTML = "";

  members.forEach(m => {
    const card = document.createElement("div");
    card.className = "member-card";
    card.innerHTML = `
      <h3>${m.name}</h3>
      <p class="text-secondary"><i class="fa-solid fa-guitar"></i> ${m.instrument}</p>
      <span class="user-badge font-sm" style="margin-top:0.5rem;">${m.role}</span>
    `;
    container.appendChild(card);
  });
}

async function setPresence(eventId, memberId, status, reason = "") {
  const body = { event_id: eventId, member_id: memberId, status: status, reason: reason, updated_at: new Date().toISOString() };
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/presences`, {
      method: "POST",
      headers: { ...getHeaders(), "On-Conflict": "event_id,member_id" },
      body: JSON.stringify(body)
    });
    await loadData();
  } catch (err) { console.error(err); }
}

function triggerAbsenceModal(eventId, memberId) {
  if(document.getElementById("absence-event-id")) document.getElementById("absence-event-id").value = eventId;
  if(document.getElementById("absence-member-id")) document.getElementById("absence-member-id").value = memberId;
  openModal("modal-absence-reason");
}

function toggleCustomAbsenceInput() {
  const select = document.getElementById("absence-select-reason");
  const group = document.getElementById("custom-absence-group");
  if (select && group) {
    if (select.value === "Outro") group.classList.remove("hidden");
    else group.classList.add("hidden");
  }
}

// ================= VISUALIZADOR DE CIFRAS =================

function openCifraViewer(songId) {
  const song = songs.find(s => s.id === songId);
  if (!song) return;
  currentViewingSong = song;
  originalSongChords = song.chords;
  currentKeyOffset = 0;
  
  if(document.getElementById("view-song-title")) document.getElementById("view-song-title").textContent = song.title;
  if(document.getElementById("view-song-artist")) document.getElementById("view-song-artist").textContent = song.artist;
  if(document.getElementById("view-song-rhythm")) document.getElementById("view-song-rhythm").textContent = song.rhythm || "Balada";
  
  renderParsedCifra();
  if(document.getElementById("cifra-viewer-overlay")) document.getElementById("cifra-viewer-overlay").classList.add("active");
}

function closeCifraViewer() {
  stopAutoScroll();
  if(document.getElementById("cifra-viewer-overlay")) document.getElementById("cifra-viewer-overlay").classList.remove("active");
}

function transpose(offset) {
  currentKeyOffset = (currentKeyOffset + offset) % 12;
  renderParsedCifra();
}

function renderParsedCifra() {
  if (!currentViewingSong) return;
  
  const baseKeyIndex = CHORDS_SCALE.indexOf(currentViewingSong.key.toUpperCase());
  const displayKeyIndex = (baseKeyIndex + currentKeyOffset + 12) % 12;
  
  const currentKeyDisplay = document.getElementById("current-key-display");
  if (currentKeyDisplay) currentKeyDisplay.textContent = CHORDS_SCALE[displayKeyIndex];

  let chordsText = originalSongChords;
  if (currentKeyOffset !== 0) {
    chordsText = chordsText.replace(/\[(.*?)\]/g, (match, chord) => {
      return `[${transposeChord(chord, currentKeyOffset)}]`;
    });
  }

  const output = chordsText.replace(/\[(.*?)\]/g, '<span class="chord-highlight">$1</span>');
  const renderedArea = document.getElementById("cifra-content-area");
  if (renderedArea) {
    renderedArea.innerHTML = output;
    renderedArea.style.fontSize = `${currentFontSize}px`;
  }
}

function transposeChord(chord, offset) {
  return chord.replace(/[A-G]#?/g, (note) => {
    let idx = CHORDS_SCALE.indexOf(note);
    if (idx === -1) return note;
    return CHORDS_SCALE[(idx + offset + 12) % 12];
  });
}

function toggleAutoScroll(speed) {
  stopAutoScroll();
  const bodyEl = document.querySelector(".cifra-viewer-body");
  if (!bodyEl) return;

  const intervalTime = speed === 1 ? 50 : 25;
  autoScrollInterval = setInterval(() => {
    bodyEl.scrollTop += 1;
  }, intervalTime);
}

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
}

function adjustFontSize(dir) {
  currentFontSize = Math.max(12, Math.min(28, currentFontSize + (dir * 2)));
  const renderedArea = document.getElementById("cifra-content-area");
  if (renderedArea) renderedArea.style.fontSize = `${currentFontSize}px`;
}

// ================= CONFIGURAÇÃO SEGURA DOS FORMULÁRIOS =================

function setupForms() {
  // 1. Envio de Novas Cifras
  const formSong = document.getElementById("form-add-song");
  if (formSong) {
    formSong.onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        title: document.getElementById("song-title").value,
        artist: document.getElementById("song-artist").value,
        key: document.getElementById("song-key").value,
        rhythm: document.getElementById("song-rhythm").value,
        chords: document.getElementById("song-chords").value
      };
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/songs`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(body)
        });
        if (res.ok) {
          alert("Música adicionada!");
          closeModal("modal-add-song");
          formSong.reset();
          await loadData();
        }
      } catch (err) { console.error(err); }
    };
  }

  // 2. Envio de Fotos (Upload Físico Real para o Bucket Storage)
  const formPhoto = document.getElementById("form-add-photo");
  if (formPhoto) {
    formPhoto.onsubmit = async (e) => {
      e.preventDefault();
      const caption = document.getElementById("photo-caption").value;
      const fileInput = document.getElementById("photo-file");
      const submitBtn = document.getElementById("btn-submit-photo");

      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Por favor, selecione uma imagem.");
        return;
      }

      const file = fileInput.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Enviando para o servidor...";
        }

        const { data, error } = await supabase.storage
          .from('photos')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        const resMeta = await fetch(`${SUPABASE_URL}/rest/v1/photos`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ caption: caption, url: publicUrl })
        });

        if (resMeta.ok) {
          alert("Foto adicionada com sucesso!");
          closeModal("modal-add-photo");
          formPhoto.reset();
          await loadData();
        }
      } catch (err) {
        console.error(err);
        alert("Erro no upload físico da imagem.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Adicionar à Galeria";
        }
      }
    };
  }

  // 3. Envio de Escalas / Eventos
  const formEvent = document.getElementById("form-add-event");
  if (formEvent) {
    formEvent.onsubmit = async (e) => {
      e.preventDefault();
      const checkedSongs = Array.from(document.querySelectorAll('input[name="event-songs-select"]:checked')).map(cb => cb.value);
      const checkedMembers = Array.from(document.querySelectorAll('input[name="event-members-select"]:checked')).map(cb => ({
        memberId: cb.value,
        role: document.getElementById(`role-for-${cb.value}`).value || "Músico"
      }));

      const hexInput = document.getElementById("event-colors-hex").value;
      const dressColors = hexInput ? hexInput.split(",").map(c => c.trim()) : [];

      const body = {
        title: document.getElementById("event-title").value,
        type: document.getElementById("event-type").value,
        date: document.getElementById("event-date").value,
        time: document.getElementById("event-time").value,
        arrival_time: document.getElementById("event-arrival").value,
        dress_code: document.getElementById("event-dress").value,
        dress_colors: dressColors,
        songs: checkedSongs,
        team: checkedMembers
      };

      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(body)
        });
        if (res.ok) {
          alert("Evento escalado!");
          closeModal("modal-add-event");
          formEvent.reset();
          await loadData();
        }
      } catch (err) { console.error(err); }
    };
  }
  
  // 4. Tratamento do Formulário de Justificativa de Ausência
  const formAbsence = document.getElementById("form-absence-reason");
  if (formAbsence) {
    formAbsence.onsubmit = async (e) => {
      e.preventDefault();
      const eventId = document.getElementById("absence-event-id").value;
      const memberId = document.getElementById("absence-member-id").value;
      const selectReason = document.getElementById("absence-select-reason").value;
      const customReason = document.getElementById("absence-custom-reason").value;
      const finalReason = selectReason === "Outro" ? customReason : selectReason;

      await setPresence(eventId, memberId, "declined", finalReason);
      closeModal("modal-absence-reason");
      formAbsence.reset();
    };
  }
}

// ================= AUTENTICAÇÃO E CADASTRO COMPLETO =================

function toggleAuthForms(view) {
  const loginCard = document.getElementById("auth-login-card");
  const registerCard = document.getElementById("auth-register-card");
  if (view === 'register') {
    if(loginCard) loginCard.classList.add("hidden");
    if(registerCard) registerCard.classList.remove("hidden");
  } else {
    if(registerCard) registerCard.classList.add("hidden");
    if(loginCard) loginCard.classList.remove("hidden");
  }
}

function setupAuthForms() {
  const regAccess = document.getElementById("register-access");
  if(regAccess) {
    regAccess.onchange = (e) => {
      const group = document.getElementById("register-admin-code-group");
      if (group) {
        if (e.target.value === "Administrador") group.classList.remove("hidden");
        else group.classList.add("hidden");
      }
    };
  }

  const fLogin = document.getElementById("form-auth-login");
  if(fLogin) {
    fLogin.onsubmit = (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim().toLowerCase();
      const pass = document.getElementById("login-password").value;
      const errorMsg = document.getElementById("login-error-msg");

      const matched = members.find(m => m.email.toLowerCase() === email && m.password === pass);
      if (matched) {
        if(errorMsg) errorMsg.classList.add("hidden");
        localStorage.setItem("cca_user", JSON.stringify(matched));
        currentUserId = matched.id;
        if(document.getElementById("auth-screen-overlay")) document.getElementById("auth-screen-overlay").classList.remove("active");
        fLogin.reset();
        setupUserSelector();
        renderActiveView();
      } else {
        if(errorMsg) errorMsg.classList.remove("hidden");
      }
    };
  }

  const fRegister = document.getElementById("form-auth-register");
  if(fRegister) {
    fRegister.onsubmit = async (e) => {
      e.preventDefault();
      const p1 = document.getElementById("register-password").value;
      const p2 = document.getElementById("register-confirm").value;
      if (p1 !== p2) {
        alert