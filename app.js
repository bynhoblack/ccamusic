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

// --- AUTENTICAÇÃO REAL ---
async function registrarUsuario(name, emailPrefix, password, confirmPassword, role, adminCode) {
    if (password !== confirmPassword) return alert("As senhas não coincidem!");
    if (password.length < 6) return alert("A senha deve ter pelo menos 6 caracteres.");
    
    // Constrói o e-mail completo
    const email = `${emailPrefix}@ccamusic.com.br`;

    try {
        // Validação de Admin
        if (role === 'Administrador' && adminCode !== '1234') { // Mude '1234' para seu código secreto
            throw new Error("Código de Administrador inválido.");
        }

        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: { data: { name: name, role: role } }
        });
        if (error) throw error;
        
        await supabaseClient.from('members').insert([{ name, email, role }]);
        alert("Cadastro realizado! Verifique seu e-mail se necessário.");
        location.reload();
    } catch (err) { alert("Erro no cadastro: " + err.message); }
}

async function logarUsuario(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        localStorage.setItem('cca_user', JSON.stringify(data.user));
        location.reload();
    } catch (err) { alert("Erro no login: " + err.message); }
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

// --- LISTENERS DE FORMULÁRIO ---
function initAuthListeners() {
    const accessSelect = document.getElementById('register-access');
    const adminCodeGroup = document.getElementById('register-admin-code-group');
    if (accessSelect) {
        accessSelect.addEventListener('change', (e) => {
            adminCodeGroup.classList.toggle('hidden', e.target.value !== 'Administrador');
        });
    }

    const regForm = document.getElementById('form-auth-register');
    if(regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await registrarUsuario(
                document.getElementById('register-name').value,
                document.getElementById('register-email-user').value,
                document.getElementById('register-password').value,
                document.getElementById('register-confirm').value,
                document.getElementById('register-access').value,
                document.getElementById('register-admin-code').value
            );
        });
    }

    const logForm = document.getElementById('form-auth-login');
    if(logForm) {
        logForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await logarUsuario(
                document.getElementById('login-email').value,
                document.getElementById('login-password').value
            );
        });
    }
}

function toggleAuthForms(type) {
    document.getElementById('auth-login-card').classList.toggle('hidden', type === 'register');
    document.getElementById('auth-register-card').classList.toggle('hidden', type === 'login');
}

function checkAuth() {
    const user = localStorage.getItem('cca_user');
    const authOverlay = document.getElementById('auth-screen-overlay');
    if (authOverlay) authOverlay.classList.toggle('active', !user);
}

function updateLiveDate() {
    const el = document.getElementById('live-date');
    if (el) el.textContent = new Date().toLocaleDateString('pt-BR');
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }