// Dados iniciais para o Portal CCA Music
const INITIAL_MEMBERS = [
  {
    id: "m1",
    name: "Gabriela Silva",
    instrument: "Voz Principal",
    email: "gabriela.silva@ccamusic.com.br",
    phone: "(11) 99876-5432",
    photo: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=150&h=150&fit=crop&q=80",
    role: "Líder de Louvor",
    accessLevel: "Administrador"
  },
  {
    id: "m2",
    name: "Lucas Ramos",
    instrument: "Teclado / Piano",
    email: "lucas.ramos@ccamusic.com.br",
    phone: "(11) 98765-4321",
    photo: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=150&h=150&fit=crop&q=80",
    role: "Diretor Musical",
    accessLevel: "Administrador"
  },
  {
    id: "m3",
    name: "Felipe Almeida",
    instrument: "Guitarra",
    email: "felipe.almeida@ccamusic.com.br",
    phone: "(11) 97654-3210",
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&q=80",
    role: "Membro",
    accessLevel: "Membro"
  },
  {
    id: "m4",
    name: "Matheus Costa",
    instrument: "Bateria",
    email: "matheus.costa@ccamusic.com.br",
    phone: "(11) 96543-2109",
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&q=80",
    role: "Membro",
    accessLevel: "Membro"
  },
  {
    id: "m5",
    name: "Bruna Oliveira",
    instrument: "Contrabaixo",
    email: "bruna.oliveira@ccamusic.com.br",
    phone: "(11) 95432-1098",
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&q=80",
    role: "Membro",
    accessLevel: "Membro"
  },
  {
    id: "m6",
    name: "Thiago Santos",
    instrument: "Violão / Voz",
    email: "thiago.santos@ccamusic.com.br",
    phone: "(11) 94321-0987",
    photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&q=80",
    role: "Membro",
    accessLevel: "Membro"
  }
];

const INITIAL_SONGS = [
  {
    id: "s1",
    title: "Porque Ele Vive",
    artist: "Harpa Cristã",
    key: "G",
    rhythm: "Balada",
    tags: ["Clássico", "Adoração"],
    chords: `
Intro: [G] [C] [G] [D]

[G] Deus enviou seu Filho a[C]mado
Para mor[G]rer em meu lu[D]gar
Na cruz so[G]freu por meus pe[C]cados
Mas o túmulo va[G]zio está
Porque [D] Ele vi[G]ve

Refrão:
Porque Ele [G] vive, eu posso crer no ama[C]nhã
Porque Ele [G] vive, temor não [D] há
Mas eu bem [G] sei, eu sei, que a minha [C] vida
Está nas [G] mãos do meu Se[D]nhor, que vivo es[G]tá
`
  },
  {
    id: "s2",
    title: "Rendido Estou",
    artist: "Aline Barros",
    key: "C",
    rhythm: "Pop Rock",
    tags: ["Adoração", "Intimidade"],
    chords: `
Intro: [Am] [F] [C] [G]

[Am] Toma-me, ren[F]de-me a Ti
[C] Quero me encon[G]trar com o Teu amor
[Am] Teus caminhos [F] quero seguir
[C] Teu coração é o meu [G] lar

Refrão:
[F] Rendido es[C]tou em Teus bra[G]ços, Senhor
[F] Rendido es[C]tou ao Teu grande [G] amor
[F] Atraído [C] fui, me entre[G]go a Ti
[F] Rendido es[C]tou em Teus bra[G]ços, Senhor
`
  },
  {
    id: "s3",
    title: "Em Teus Braços",
    artist: "Laura Souguellis",
    key: "E",
    rhythm: "Worship",
    tags: ["Suave", "Worship"],
    chords: `
Intro: [E] [A] [C#m] [B]

[E] Segura estou nos [A] braços
Daquele que nun[C#m]ca me deixou
Seu amor me [B] acolheu
[E] Segura estou nos [A] braços
Daquele que nun[C#m]ca me deixou
Seu amor me [B] acolheu

Refrão:
[A] E o meu coração se acalma
[E] E o meu coração se acalma
[C#m] E o meu coração se acalma
Porque o [B] Teu amor é real
`
  }
];

const INITIAL_EVENTS = [
  {
    id: "e1",
    title: "Culto de Domingo - Manhã",
    type: "Culto",
    date: "2026-05-31",
    time: "09:00",
    arrivalTime: "08:15",
    dressCode: "Preto com Detalhes em Azul Marinho",
    dressColors: ["#000000", "#002060"],
    songs: ["s1", "s2"],
    team: [
      { memberId: "m1", role: "Vocal Principal" },
      { memberId: "m2", role: "Teclado" },
      { memberId: "m3", role: "Guitarra" },
      { memberId: "m4", role: "Bateria" },
      { memberId: "m5", role: "Baixo" }
    ],
    presences: {
      "m1": { status: "confirmed", reason: "" },
      "m2": { status: "confirmed", reason: "" },
      "m3": { status: "pending", reason: "" },
      "m4": { status: "declined", reason: "Trabalho no domingo de manhã" },
      "m5": { status: "confirmed", reason: "" }
    }
  },
  {
    id: "e2",
    title: "Ensaio Geral da Semana",
    type: "Ensaio",
    date: "2026-06-03",
    time: "20:00",
    arrivalTime: "19:45",
    dressCode: "Casual Livre",
    dressColors: ["#4a5568", "#a0aec0"],
    songs: ["s2", "s3"],
    team: [
      { memberId: "m1", role: "Vocal Principal" },
      { memberId: "m2", role: "Teclado" },
      { memberId: "m3", role: "Guitarra" },
      { memberId: "m4", role: "Bateria" },
      { memberId: "m5", role: "Baixo" },
      { memberId: "m6", role: "Violão / Apoio" }
    ],
    presences: {
      "m1": { status: "confirmed", reason: "" },
      "m2": { status: "confirmed", reason: "" },
      "m3": { status: "confirmed", reason: "" },
      "m4": { status: "confirmed", reason: "" },
      "m5": { status: "declined", reason: "Consulta médica marcada" },
      "m6": { status: "pending", reason: "" }
    }
  }
];

const INITIAL_PHOTOS = [
  {
    id: "p1",
    url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80",
    caption: "Apresentação no Culto de Aniversário - 2026"
  },
  {
    id: "p2",
    url: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80",
    caption: "Nosso ensaio acústico na sala de música"
  },
  {
    id: "p3",
    url: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&q=80",
    caption: "Felipe nos solos de guitarra do último domingo"
  },
  {
    id: "p4",
    url: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
    caption: "Ensaio geral com toda a equipe reunida"
  }
];

// Salva no localStorage se não existir
if (!localStorage.getItem("cca_members")) {
  localStorage.setItem("cca_members", JSON.stringify(INITIAL_MEMBERS));
}
if (!localStorage.getItem("cca_songs")) {
  localStorage.setItem("cca_songs", JSON.stringify(INITIAL_SONGS));
}
if (!localStorage.getItem("cca_events")) {
  localStorage.setItem("cca_events", JSON.stringify(INITIAL_EVENTS));
}
if (!localStorage.getItem("cca_photos")) {
  localStorage.setItem("cca_photos", JSON.stringify(INITIAL_PHOTOS));
}

// Contas de usuários padrão para o portal com níveis de acesso explícitos
const INITIAL_USERS = [
  { email: "gabriela.silva@ccamusic.com.br", password: "123", memberId: "m1", accessLevel: "Administrador" },
  { email: "lucas.ramos@ccamusic.com.br", password: "123", memberId: "m2", accessLevel: "Administrador" },
  { email: "admin@ccamusic.com", password: "admin", memberId: "m1", accessLevel: "Administrador" }
];
if (!localStorage.getItem("cca_users")) {
  localStorage.setItem("cca_users", JSON.stringify(INITIAL_USERS));
}

// Script de Migração: Garante que os registros existentes no localStorage tenham o campo 'accessLevel'
(function migrateRoles() {
  try {
    let localMembers = JSON.parse(localStorage.getItem("cca_members"));
    let localUsers = JSON.parse(localStorage.getItem("cca_users"));

    if (localMembers && localMembers.length > 0) {
      let changed = false;
      localMembers.forEach(m => {
        if (!m.accessLevel) {
          // Gabriela e Lucas são administradores nativos, outros são membros normais
          if (m.id === "m1" || m.id === "m2" || m.email === "gabriela.silva@ccamusic.com.br" || m.email === "lucas.ramos@ccamusic.com.br") {
            m.accessLevel = "Administrador";
          } else {
            m.accessLevel = "Membro";
          }
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem("cca_members", JSON.stringify(localMembers));
      }
    }

    if (localUsers && localUsers.length > 0) {
      let changed = false;
      localUsers.forEach(u => {
        if (!u.accessLevel) {
          if (u.email === "gabriela.silva@ccamusic.com.br" || u.email === "lucas.ramos@ccamusic.com.br" || u.email === "admin@ccamusic.com") {
            u.accessLevel = "Administrador";
          } else {
            u.accessLevel = "Membro";
          }
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem("cca_users", JSON.stringify(localUsers));
      }
    }
  } catch (e) {
    console.error("Erro na migração de dados de acesso:", e);
  }
})();