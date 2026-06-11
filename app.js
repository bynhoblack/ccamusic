// --- CONFIGURAÇÃO GLOBAL ---
const SUPABASE_URL = 'https://ldsyjywdufhrblncadvj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3lqeXdkdWZocmJsbmNhZHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTM5ODMsImV4cCI6MjA5NjU4OTk4M30.9CO7Jziy-VItNFlpDGKlkrV6f_DPXwmq-Mdu5rRYaCk';

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

// --- CARREGAMENTO DE DADOS ---
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

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      renderActiveView(button.getAttribute('data-tab'));
    });
  });
}

// --- FUNÇÕES DE RENDERIZAÇÃO DE TELA ---
function renderDashboard() { document.getElementById("page-title").textContent = "Painel Geral"; }
function renderEscalas() { document.getElementById("page-title").textContent = "Escalas & Presença"; }
function renderCifras() { document.getElementById("page-title").textContent = "Banco de Cifras"; }
function renderGaleria() { document.getElementById("page-title").textContent = "Galeria"; }
function renderMembros() { document.getElementById("page-title").textContent = "Integrantes"; }

// --- AUTH & MODAIS ---
function checkAuth() {
  const user = localStorage.getItem('cca_user');
  const authOverlay = document.getElementById('auth-screen-overlay');
  if (authOverlay) {
    user ? authOverlay.classList.remove('active') : authOverlay.classList.add('active');
  }
}

function toggleAuthForms(type) {
  const loginCard = document.getElementById('auth-login-card');
  const registerCard = document.getElementById('auth-register-card');
  if (type === 'register') {
    loginCard.classList.add('hidden');
    registerCard.classList.remove('hidden');
  } else {
    loginCard.classList.remove('hidden');
    registerCard.classList.add('hidden');
  }
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

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

function updateLiveDate() {
  const el = document.getElementById('live-date');
  if (el) el.textContent = new Date().toLocaleDateString('pt-BR');
}