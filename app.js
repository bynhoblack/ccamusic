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

// --- INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", async () => {
    initAuthListeners();
    setupNavigation();
    updateLiveDate();
    await loadData();
    checkAuth();
});

// --- CARREGAMENTO DE DADOS ---
async function loadData() {
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
            return response.json();
        }));

        [members, songs, events, photos, presencesCache] = results;
        renderActiveView();
    } catch (err) {
        console.error("Erro na sincronização:", err);
    }
}

// --- NAVEGAÇÃO E UI ---
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            renderActiveView(button.getAttribute('data-tab'));
        });
    });
}

function renderActiveView(tabId = null) {
    if (!tabId) {
        const activeTabItem = document.querySelector(".nav-item.active");
        tabId = activeTabItem ? activeTabItem.getAttribute("data-tab") : "dashboard";
    }
    
    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) targetView.classList.add('active');
    
    const titles = { "dashboard": "Painel Geral", "escalas": "Escalas & Presença", "cifras": "Banco de Cifras", "galeria": "Galeria", "membros": "Integrantes" };
    const titleEl = document.getElementById("page-title");
    if(titleEl) titleEl.textContent = titles[tabId] || "Portal";
}

// --- AUTENTICAÇÃO E FORMULÁRIOS ---
function checkAuth() {
    const user = localStorage.getItem('cca_user');
    const authOverlay = document.getElementById('auth-screen-overlay');
    if (authOverlay) {
        user ? authOverlay.classList.remove('active') : authOverlay.classList.add('active');
    }
}

function initAuthListeners() {
    // Listener para o seletor de administrador
    const accessSelect = document.getElementById('register-access');
    const adminCodeGroup = document.getElementById('register-admin-code-group');
    if (accessSelect) {
        accessSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Administrador') {
                adminCodeGroup.classList.remove('hidden');
            } else {
                adminCodeGroup.classList.add('hidden');
            }
        });
    }

    // Bloquear recarregamento dos formulários
    const registerForm = document.getElementById('form-auth-register');
    if(registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            localStorage.setItem('cca_user', 'active');
            location.reload();
        });
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

// --- UTILIDADES ---
function updateLiveDate() {
    const el = document.getElementById('live-date');
    if (el) el.textContent = new Date().toLocaleDateString('pt-BR');
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }