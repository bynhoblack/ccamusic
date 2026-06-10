// Portal CCA Music - Lógica de Negócios e Estado (Conectado ao Supabase)
// =====================================================================

// CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = "https://ldsyjywdufhrblncadvj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_oxkG6V8AV2YFrRVRc-Bygg_hHrbwKyV";

// Headers padrão para falar com a API do Supabase REST
const supabaseHeaders = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

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
document.addEventListener("DOMContentLoaded", async () => {
  await loadDataFromSupabase();
  checkAuth();
  setupUserSelector();
  setupNavigation();
  setupForms();
  setupAuthForms();
  renderActiveView();
  updateLiveDate();
});

// Busca os dados em tempo real nas tabelas do Supabase
async function loadDataFromSupabase() {
  try {
    // 1. Busca Membros
    const resMembers = await fetch(`${SUPABASE_URL}/rest/v1/members?select=*`, { headers: supabaseHeaders });
    members = await resMembers.json() || [];

    // 2. Busca Cifras
    const resSongs = await fetch(`${SUPABASE_URL}/rest/v1/songs?select=*`, { headers: supabaseHeaders });
    songs = await resSongs.json() || [];

    // 3. Busca Eventos
    const resEvents = await fetch(`${SUPABASE_URL}/rest/v1/events?select=*`, { headers: supabaseHeaders });
    events = await resEvents.json() || [];

    // 4. Busca Fotos
    const resPhotos = await fetch(`${SUPABASE_URL}/rest/v1/photos?select=*`, { headers: supabaseHeaders });
    photos = await resPhotos.json() || [];

    // Gerenciamento de Sessão de Login
    const loggedEmail = localStorage.getItem("cca_auth_token");
    if (loggedEmail) {
      const matched = members.find(m => m.email === loggedEmail);
      if (matched) {
        currentUserId = matched.id;
        localStorage.setItem("cca_current_member", currentUserId);
        return;
      }
    }

    const savedUser = localStorage.getItem("cca_current_member");
    if (savedUser && members.some(m => m.id === savedUser)) {
      currentUserId = savedUser;
    } else if (members.length > 0) {
      currentUserId = members[0].id;
      localStorage.setItem("cca_current_member", currentUserId);
    }
  } catch (error) {
    console.error("Erro ao carregar dados do Supabase:", error);
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

// Configura o Perfil de Usuário na Barra Lateral
function setupUserSelector() {
  const container = document.getElementById("user-profile-box");
  if (!container) return;

  const member = members.find(m => m.id === currentUserId);
  if (!member) {
    container.innerHTML = `<p class="text-secondary">Nenhum usuário ativo</p>`;
    return;
  }

  const avatarUrl = member.photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&q=80";
  
  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
      <img src="${avatarUrl}" alt="${member.name}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-purple); box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
      <div style="flex: 1; min-width: 0;">
        <h4 style="font-size: 0.9rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; color: #fff;">
          ${member.name}
        </h4>
        <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          @${member.nickname || member.name.split(" ")[0]}
        </p>
      </div>
    </div>
    <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
      <span class="user-badge" id="user-role-badge">${member.role}</span>
    </div>
  `;

  updateUserBadge();
}

function updateUserBadge() {
  const badge = document.getElementById("user-role-badge");
  const currentMember = members.find(m => m.id === currentUserId);
  if (currentMember && badge) {
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

// Controla as permissões de acesso em tempo real baseado no Supabase
function applyPermissions() {
  const currentMember = members.find(m => m.id === currentUserId);
  const accessLevel = currentMember ? (currentMember.accessLevel || "Membro") : "Membro";

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

// Troca de Abas
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

function updateLiveDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const element = document.getElementById("live-date");
  if(element) element.textContent = new Date().toLocaleDateString('pt-BR', options);
}

// 1. DASHBOARD
function renderDashboard() {
  if(document.getElementById("stat-songs-count")) document.getElementById("stat-songs-count").textContent = `${songs.length} Músicas`;
  if(document.getElementById("stat-members-count")) document.getElementById("stat-members-count").textContent = `${members.length} Integrantes`;

  const todayStr = new Date().toISOString().split("T")[0];
  const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  let nextEvent = sortedEvents.find(e => e.date >= todayStr);
  if (!nextEvent && sortedEvents.length > 0) {
    nextEvent = sortedEvents[sortedEvents.length - 1];
  }

  if (!nextEvent) {
    if(document.getElementById("dash-event-title")) document.getElementById("dash-event-title").textContent = "Nenhum evento agendado.";
    return;
  }

  if(document.getElementById("stat-next-date")) document.getElementById("stat-next-date").textContent = formatDateShort(nextEvent.date);
  if(document.getElementById("dash-event-title")) document.getElementById("dash-event-title").textContent = `${nextEvent.title} (${nextEvent.type})`;
  if(document.getElementById("dash-event-time")) document.getElementById("dash-event-time").textContent = `${nextEvent.time}h`;
  if(document.getElementById("dash-event-arrival")) document.getElementById("dash-event-arrival").textContent = `${nextEvent.arrivalTime}h`;
  if(document.getElementById("dash-event-dress")) document.getElementById("dash-event-dress").textContent = nextEvent.dressCode || "Livre";

  const colorsContainer = document.getElementById("dash-event-colors");
  if (colorsContainer) {
    colorsContainer.innerHTML = "";
    if (nextEvent.dressColors && nextEvent.dressColors.length > 0) {
      nextEvent.dressColors.forEach(color => {
        const dot = document.createElement("div");
        dot.className = "color-dot";
        dot.style.backgroundColor = color.trim();
        colorsContainer.appendChild(dot);
      });
    }
  }

  // Preenche a Escala Detalhada
  const scaleList = document.getElementById("dash-event-scale-list");
  if (scaleList) {
    scaleList.innerHTML = "";
    const teamList = typeof nextEvent.team === "string" ? JSON.parse(nextEvent.team) : (nextEvent.team || []);
    const presencesObj = typeof nextEvent.presences === "string" ? JSON.parse(nextEvent.presences) : (nextEvent.presences || {});

    teamList.forEach(t => {
      const m = members.find(member => member.id == t.memberId);
      if (!m) return;

      const presenceInfo = presencesObj[m.id] || { status: "pending", reason: "" };
      let statusClass = presenceInfo.status === "confirmed" ? "confirmed" : (presenceInfo.status === "declined" ? "declined" : "pending");

      const li = document.createElement("li");
      li.className = "scale-member-item";
      li.innerHTML = `
        <div class="scale-member-left">
          <img class="scale-member-avatar" src="${m.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80'}">
          <div class="scale-member-info">
            <h4>${m.name}</h4>
            <span>${t.role}</span>
          </div>
        </div>
        <span class="status-indicator ${statusClass}">
          ${presenceInfo.status === "confirmed" ? "✓ Confirmado" : (presenceInfo.status === "declined" ? "✗ Ausente" : "○ Pendente")}
        </span>
      `;
      scaleList.appendChild(li);
    });
  }

  // Preenche as Músicas
  const songsList = document.getElementById("dash-event-songs-list");
  if (songsList) {
    songsList.innerHTML = "";
    const eventSongs = typeof nextEvent.songs === "string" ? JSON.parse(nextEvent.songs) : (nextEvent.songs || []);
    if (eventSongs.length > 0) {
      eventSongs.forEach(songId => {
        const s = songs.find(song => song.id == songId);
        if (!s) return;
        const card = document.createElement("div");
        card.className = "song-link-card";
        card.onclick = () => openCifraViewer(s.id);
        card.innerHTML = `
          <div class="song-link-info"><h4>${s.title}</h4><span>${s.artist}</span></div>
          <span class="song-link-key">${s.key}</span>
        `;
        songsList.appendChild(card);
      });
    } else {
      songsList.innerHTML = "<p class='text-secondary font-sm'>Nenhuma música vinculada.</p>";
    }
  }
}

// 2. ESCALAS
function renderEscalas() {
  const container = document.getElementById("events-cards-container");
  if (!container) return;
  container.innerHTML = "";

  if (events.length === 0) {
    container.innerHTML = `<div class="card" style="padding: 3rem; text-align: center;"><h3>Nenhum evento agendado</h3></div>`;
    return;
  }

  events.forEach(ev => {
    const card = document.createElement("div");
    card.className = "card event-card";
    card.innerHTML = `
      <div class="event-card-header">
        <span class="event-type-tag">${ev.type}</span>
        <span class="event-date-badge">${formatDateShort(ev.date)}</span>
      </div>
      <div class="event-card-body">
        <h3>${ev.title}</h3>
        <p>Horário: <strong>${ev.time}h</strong></p>
        <p>Roupas: <strong>${ev.dressCode || "Livre"}</strong></p>
      </div>
    `;
    container.appendChild(card);
  });
}

// 3. CIFRAS
function renderCifras() {
  const container = document.getElementById("cifras-cards-container");
  if (!container) return;
  container.innerHTML = "";

  const searchQuery = document.getElementById("search-cifras")?.value.toLowerCase() || "";

  const filtered = songs.filter(s => s.title.toLowerCase().includes(searchQuery) || s.artist.toLowerCase().includes(searchQuery));

  filtered.forEach(s => {
    const card = document.createElement("div");
    card.className = "card cifra-card";
    card.onclick = () => openCifraViewer(s.id);
    card.innerHTML = `
      <h3>${s.title}</h3>
      <p class="text-secondary">${s.artist}</p>
      <span class="cifra-card-key">${s.key}</span>
    `;
    container.appendChild(card);
  });
}

// 4. GALERIA
function renderGaleria() {
  const container = document.getElementById("gallery-container");
  if (!container) return;
  container.innerHTML = "";

  photos.forEach(p => {
    const div = document.createElement("div");
    div.className = "gallery-item";
    div.innerHTML = `
      <img src="${p.url}" loading="lazy">
      <div class="gallery-caption">${p.caption}</div>
    `;
    container.appendChild(div);
  });
}

// 5. INTEGRANTES
function renderMembros() {
  const container = document.getElementById("members-container");
  if (!container) return;
  container.innerHTML = "";

  members.forEach(m => {
    const card = document.createElement("div");
    card.className = "card member-card";
    card.innerHTML = `
      <img class="member-avatar-lg" src="${m.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&q=80'}">
      <h3>${m.name}</h3>
      <span class="member-instrument-label">${m.instrument || "Vocal"}</span>
      <p>${m.email}</p>
    `;
    container.appendChild(card);
  });
}

// CONFIGURAÇÃO DOS FORMULÁRIOS DE AUTENTICAÇÃO (SISTEMA DE CADASTRO REAL)
function setupAuthForms() {
  const loginForm = document.getElementById("form-auth-login");
  const registerForm = document.getElementById("form-auth-register");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("auth-email").value.trim();
      const password = document.getElementById("auth-password").value;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/members?email=eq.${email}&password=eq.${password}`, {
        headers: supabaseHeaders
      });
      const data = await res.json();

      if (data && data.length > 0) {
        localStorage.setItem("cca_auth_token", email);
        localStorage.setItem("cca_current_member", data[0].id);
        currentUserId = data[0].id;
        
        await loadDataFromSupabase();
        checkAuth();
        setupUserSelector();
        renderActiveView();
      } else {
        alert("E-mail ou senha incorretos.");
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("register-name").value.trim();
      const email = document.getElementById("register-email").value.trim();
      const password = document.getElementById("register-password").value;
      const instrument = document.getElementById("register-instrument").value;
      const adminCode = document.getElementById("register-admin-code")?.value.trim();

      const accessLevel = (adminCode === "CCA2026") ? "Administrador" : "Membro";
      const role = accessLevel === "Administrador" ? "Líder" : "Membro";

      const newMember = {
        name,
        email,
        password,
        instrument,
        accessLevel,
        role,
        photo: ""
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
        method: "POST",
        headers: supabaseHeaders,
        body: JSON.stringify(newMember)
      });

      if (res.ok) {
        alert("Conta criada com sucesso! Faça seu login.");
        document.getElementById("btn-goto-login")?.click();
      } else {
        alert("Erro ao criar conta no banco de dados.");
      }
    });
  }
}

// CONFIGURAÇÃO DE TRANSIÇÃO DE TELAS (IDs e Coringa por Texto)
function setupForms() {
  // 1. Procura padrão pelos IDs conhecidos do HTML antigo/novo
  const btnGotoRegister = document.getElementById("btn-goto-register");
  const btnGotoLogin = document.getElementById("btn-goto-login");
  const authLoginBox = document.getElementById("auth-login-box") || document.querySelector(".auth-card:not(.register-card)");
  const authRegisterBox = document.getElementById("auth-register-box") || document.querySelector(".register-card");

  if (btnGotoRegister) {
    btnGotoRegister.addEventListener("click", (e) => {
      e.preventDefault();
      if (authLoginBox) authLoginBox.style.display = "none";
      if (authRegisterBox) authRegisterBox.style.display = "block";
      document.getElementById("form-auth-login")?.classList.add("hidden");
      document.getElementById("form-auth-register")?.classList.remove("hidden");
    });
  }

  if (btnGotoLogin) {
    btnGotoLogin.addEventListener("click", (e) => {
      e.preventDefault();
      if (authRegisterBox) authRegisterBox.style.display = "none";
      if (authLoginBox) authLoginBox.style.display = "block";
      document.getElementById("form-auth-register")?.classList.add("hidden");
      document.getElementById("form-auth-login")?.classList.remove("hidden");
    });
  }

  // 2. FUNÇÃO CORINGA: Ativa cliques baseados nos textos dos links/botões
  document.querySelectorAll("a, button").forEach(el => {
    const texto = el.textContent.toLowerCase();
    
    if (texto.includes("cadast") || texto.includes("criar") || texto.includes("registr")) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const loginForm = document.getElementById("form-auth-login") || document.querySelector("form:first-of-type");
        const registerForm = document.getElementById("form-auth-register") || document.querySelector("form:last-of-type");
        
        if (loginForm && registerForm) {
          loginForm.style.display = "none";
          loginForm.classList.add("hidden");
          registerForm.style.display = "block";
          registerForm.classList.remove("hidden");
        }
      });
    }
    
    if (texto.includes("login") || texto.includes("já tenho") || texto.includes("entrar")) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const loginForm = document.getElementById("form-auth-login") || document.querySelector("form:first-of-type");
        const registerForm = document.getElementById("form-auth-register") || document.querySelector("form:last-of-type");
        
        if (loginForm && registerForm) {
          registerForm.style.display = "none";
          registerForm.classList.add("hidden");
          loginForm.style.display = "block";
          loginForm.classList.remove("hidden");
        }
      });
    }
  });
}

// Suporte global para alternância manual caso o HTML use eventos do tipo onclick="toggleAuthMode()"
function toggleAuthMode() {
  const loginForm = document.getElementById("form-auth-login");
  const registerForm = document.getElementById("form-auth-register");
  if (loginForm && registerForm) {
    loginForm.classList.toggle("hidden");
    registerForm.classList.toggle("hidden");
  }
}

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }
function formatDateShort(dateStr) { if(!dateStr) return ""; const parts = dateStr.split("-"); return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr; }

// Fallback de segurança personalizado para evitar colisões com palavras reservadas
function openCifraViewer(id) {
  const s = songs.find(song => song.id == id);
  if(s) {
    currentViewingSong = s;
    alert(`Visualizando cifra: ${s.title} - ${s.artist}\n\nTom original: ${s.key}\n\n(Abertura do player de transposição dinâmica)`);
  }
}

// Função exata que o seu HTML (linha 576) está chamando no clique do botão
function toggleAuthForms() {
  const loginForm = document.getElementById("form-auth-login") || document.querySelector(".auth-card:not(.register-card)");
  const registerForm = document.getElementById("form-auth-register") || document.querySelector(".register-card");
  
  if (loginForm && registerForm) {
    loginForm.classList.toggle("hidden");
    registerForm.classList.toggle("hidden");
    
    if (loginForm.classList.contains("hidden") || loginForm.style.display === "none") {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
    } else {
      loginForm.style.display = "block";
      registerForm.style.display = "none";
    }
  }
}