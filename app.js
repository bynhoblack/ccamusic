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

// Inicialização Geral da Aplicação
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

// Verifica status de autenticação (Exibe ou esconde tela de login)
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