// --- CONFIGURAÇÃO GLOBAL ---
const SUPABASE_URL = 'https://ldsyjywdufhrblncadvj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3lqeXdkdWZocmJsbmNhZHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTM5ODMsImV4cCI6MjA5NjU4OTk4M30.9CO7Jziy-VItNFlpDGKlkrV6f_DPXwmq-Mdu5rRYaCk';

// Inicialização do cliente de forma segura
let supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const getHeaders = () => ({
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
});

// Variáveis de Estado
let members = [], songs = [], events = [], photos = [], presencesCache = [];
let currentUserId = "";

// --- INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  checkAuth();
  setupNavigation();
  updateLiveDate();
});

// --- CARREGAMENTO DE DADOS (CORRIGIDO) ---
async function loadData() {
  console.log("Iniciando carga de dados...");
  try {
    const endpoints = [
      { key: 'members', url: `${SUPABASE_URL}/rest/v1/members?order=name.asc` },
      { key: 'songs', url: `${SUPABASE_URL}/rest/v1/songs?order=title.asc` },
      { key: 'events', url: `${SUPABASE_URL}/rest/v1/events?order=date.asc` },
      { key: 'photos', url: `${SUPABASE_URL}/rest/v1/photos?order=created_at.desc` },
      { key: 'presences', url: `${SUPABASE_URL}/rest/v1/presences` }
    ];

    const results = await Promise.all(endpoints.map(async (ep) => {
      const response = await fetch(ep.url, { headers: getHeaders() });
      if (!response.ok) throw new Error(`Erro ${ep.key}: ${response.status}`);
      return response.json();
    }));

    [members, songs, events, photos, presencesCache] = results;

    // Processamento relacional
    events.forEach(ev => {
      ev.presences = {};
      presencesCache.filter(p => p.event_id === ev.id).forEach(p => {
        ev.presences[p.member_id] = { status: p.status, reason: p.reason };
      });
    });

    renderActiveView();
    console.log("Carga concluída com sucesso.");
  } catch (err) {
    console.error("Erro na sincronização:", err);
    // Renderiza mesmo com erro para evitar tela travada
    renderActiveView();
  }
}

// --- NAVEGAÇÃO E UI ---
function renderActiveView(tabId = null) {
  if (!tabId) {
    const activeTabItem = document.querySelector(".nav-item.active");
    tabId = activeTabItem ? activeTabItem.getAttribute("data-tab") : "dashboard";
  }

  const views = {
    "dashboard": renderDashboard,
    "escalas": renderEscalas,
    "cifras": renderCifras,
    "galeria": renderGaleria,
    "membros": renderMembros
  };

  if (views[tabId]) views[tabId]();
}

// --- FUNÇÕES DE APOIO ---
function openLightbox(url, caption) {
  const lb = document.getElementById("lightbox");
  if (lb) {
    document.getElementById("lightbox-img").src = url;
    document.getElementById("lightbox-caption").textContent = caption;
    lb.classList.add("active");
  }
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("active");
}

// [IMPORTANTE]: Certifique-se de que no seu HTML o ID "lightbox" exista