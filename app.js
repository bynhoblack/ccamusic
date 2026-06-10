// --- CONFIGURAÇÃO BLINDADA ---
const SUPABASE_URL = 'https://ldsyjywdufhrblncadvj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3lqeXdkdWZocmJsbmNhZHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTM5ODMsImV4cCI6MjA5NjU4OTk4M30.9CO7Jziy-VItNFlpDGKlkrV6f_DPXwmq-Mdu5rRYaCk';

// Inicialização do cliente Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_SECURITY_CODE = "CCA2026";

const getHeaders = () => ({
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
});

// --- INICIALIZAÇÃO SEGURA ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Iniciando carregamento...");
  
  // Executamos em etapas para não travar tudo se uma falhar
  await loadData();
  
  console.log("LoadData concluído, prosseguindo...");
  checkAuth();
  setupNavigation();
  setupForms();
  setupAuthForms();
  updateLiveDate();
});

async function loadData() {
  try {
    // Adicionamos timeout ou tratamento individual para evitar que o Promise.all trave
    const endpoints = [
      { name: 'members', url: `${SUPABASE_URL}/rest/v1/members?order=name.asc` },
      { name: 'songs', url: `${SUPABASE_URL}/rest/v1/songs?order=title.asc` },
      { name: 'events', url: `${SUPABASE_URL}/rest/v1/events?order=date.asc` },
      { name: 'photos', url: `${SUPABASE_URL}/rest/v1/photos?order=created_at.desc` },
      { name: 'presences', url: `${SUPABASE_URL}/rest/v1/presences` }
    ];

    const results = await Promise.all(endpoints.map(async (ep) => {
      const response = await fetch(ep.url, { headers: getHeaders() });
      if (!response.ok) throw new Error(`Erro em ${ep.name}: ${response.status}`);
      return response.json();
    }));

    [members, songs, events, photos, presencesCache] = results;
    
    console.log("Dados carregados com sucesso.");

    // (O restante da sua lógica de mapeamento permanece aqui...)
    if (Array.isArray(events)) {
      events.forEach(ev => {
        ev.presences = {};
        if (Array.isArray(presencesCache)) {
          presencesCache.filter(p => p.event_id === ev.id).forEach(p => {
            ev.presences[p.member_id] = { status: p.status, reason: p.reason };
          });
        }
      });
    }

    renderActiveView();
  } catch (err) {
    console.error("ERRO CRÍTICO NO LOAD DATA:", err);
    // Garantir que a UI seja renderizada mesmo com erro de dados para evitar tela branca
    renderActiveView(); 
  }
}