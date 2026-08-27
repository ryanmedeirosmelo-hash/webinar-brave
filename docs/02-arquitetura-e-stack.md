# 02 — Arquitetura e Stack

## Stack

| Camada | Tecnologia | Observação |
|--------|-----------|------------|
| Framework | **Next.js 16** (App Router, Server Actions) | React 19 |
| Linguagem | TypeScript | |
| Estilo | Tailwind CSS | |
| Banco / Auth / Storage | **Supabase** (Postgres) | local via Docker no dev |
| Validação | **Zod** | validar formulário e payloads |
| Datas | **date-fns** / `date-fns-tz` | lidar com fuso horário |
| Deploy (fase 2) | Vercel + Supabase Cloud | |

Pacotes Supabase: `@supabase/supabase-js` e `@supabase/ssr`.

## Como o "simulated live" roda sem servidor de streaming

Não precisamos transmitir vídeo. O MP4 é servido estático (Supabase Storage ou `public/`).
O truque é **puramente no cliente + um timestamp no banco**:

```
scheduled_start_at (no banco)  ──►  o player calcula:
    elapsed = agora - scheduled_start_at
    video.currentTime = elapsed   (e bloqueia seek/pause)
```

Ou seja, qualquer pessoa pode recarregar a página: o vídeo sempre volta pro ponto certo
porque o ponto certo é derivado do relógio, não de onde ela parou.

## Estrutura de pastas sugerida

```
AutoWebinar/
├─ docs/                      ← esta documentação
├─ public/
│  └─ videos/                 ← MP4 de teste (dev). Ex.: aula.mp4
├─ supabase/
│  ├─ migrations/             ← SQL versionado (ver doc 03)
│  └─ seed.sql                ← webinar + chat + ofertas de teste
├─ src/
│  ├─ app/
│  │  ├─ [slug]/
│  │  │  └─ page.tsx          ← landing + formulário de inscrição
│  │  ├─ watch/
│  │  │  └─ [token]/
│  │  │     └─ page.tsx       ← página de assistir (Server Component)
│  │  └─ actions/
│  │     └─ registrations.ts  ← Server Action createRegistration()
│  ├─ components/
│  │  ├─ SignupForm.tsx       ← client component (escolha de dia/hora)
│  │  ├─ LivePlayer.tsx       ← client component (CORAÇÃO — ver doc 05)
│  │  ├─ SimulatedChat.tsx    ← client component
│  │  └─ TimedOffer.tsx       ← client component
│  ├─ lib/
│  │  ├─ supabase/
│  │  │  ├─ server.ts         ← client server-side (service role)
│  │  │  └─ client.ts         ← client browser (anon) — se precisar
│  │  ├─ schemas.ts           ← schemas Zod
│  │  └─ time.ts              ← helpers de cálculo de elapsed/fuso
│  └─ types/
│     └─ db.ts                ← tipos das tabelas
├─ .env.local                 ← chaves (ver doc 06)
├─ package.json
└─ next.config.ts
```

## Responsabilidade de cada peça (resumo)

- **`[slug]/page.tsx`**: busca o webinar pelo slug (server-side) e renderiza `SignupForm`.
- **`SignupForm.tsx`**: usuário escolhe dia + horário; envia pra Server Action.
- **`actions/registrations.ts`**: valida com Zod, calcula `scheduled_start_at` (em UTC),
  insere `registration`, retorna o `access_token` e redireciona pra `/watch/<token>`.
- **`watch/[token]/page.tsx`**: busca a inscrição + webinar + mensagens + ofertas (server-side)
  e passa tudo pro `LivePlayer`.
- **`LivePlayer.tsx`**: calcula o estado (antes/durante/depois), controla o `<video>`,
  e orquestra `SimulatedChat` e `TimedOffer` pelo `currentTime`.

## Segurança (nível MVP)

- Leitura de webinar/chat/ofertas e da inscrição é feita **no servidor** (Server Components /
  Server Actions) usando a **service role key** — que **nunca** vai pro browser.
- O browser só recebe os dados já filtrados daquela inscrição.
- O `access_token` é um UUID v4 (não adivinhável) → serve de "senha" do link.
- RLS do Supabase: ver doc 03. No MVP mantemos as tabelas sem acesso anônimo direto;
  todo acesso passa pelo servidor.
