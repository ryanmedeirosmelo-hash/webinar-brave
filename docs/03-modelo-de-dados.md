# 03 — Modelo de Dados

4 tabelas. Tudo no schema `public` do Postgres (Supabase).

```
webinars 1───* chat_messages
         1───* offers
         1───* registrations
```

## Diagrama de campos

### `webinars` — o produto
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `slug` | text UNIQUE | usado na URL `/<slug>` |
| `title` | text | |
| `description` | text NULL | |
| `video_url` | text | path/URL do MP4 (Storage ou `/videos/aula.mp4`) |
| `duration_seconds` | int | duração total do vídeo (pra saber quando "encerra") |
| `available_times` | jsonb | horários oferecidos, ex.: `["09:00","14:00","20:00"]` |
| `timezone` | text | fuso dos horários, ex.: `America/Sao_Paulo` |
| `status` | text | `active` / `draft` |
| `created_at` | timestamptz | `now()` |

### `chat_messages` — chat simulado
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid PK | |
| `webinar_id` | uuid FK → webinars | |
| `at_seconds` | int | segundo do vídeo em que aparece |
| `author_name` | text | nome fake de quem "mandou" |
| `message` | text | |

### `offers` — ofertas/CTAs cronometrados
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid PK | |
| `webinar_id` | uuid FK → webinars | |
| `title` | text | |
| `body` | text NULL | |
| `cta_label` | text | texto do botão, ex.: "Quero me inscrever" |
| `cta_url` | text | link do botão (checkout) |
| `show_at_seconds` | int | quando aparece |
| `hide_at_seconds` | int NULL | quando some (NULL = fica até o fim) |

### `registrations` — matrículas
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid PK | |
| `webinar_id` | uuid FK → webinars | |
| `name` | text | |
| `email` | text | |
| `scheduled_start_at` | timestamptz | **instante "ao vivo"** (sempre gravado em UTC) |
| `timezone` | text | fuso escolhido pela pessoa (default = o do webinar) |
| `access_token` | uuid UNIQUE | `gen_random_uuid()` — vai na URL de assistir |
| `created_at` | timestamptz | `now()` |

> **Regra de ouro do fuso:** grave `scheduled_start_at` **sempre em UTC** (`timestamptz` faz
> isso). Guarde o `timezone` só pra exibir bonito pro usuário. Os cálculos de `elapsed` usam UTC.

---

## Migration SQL (rodar no Supabase local)

Salvar como `supabase/migrations/0001_init.sql`:

```sql
-- 0001_init.sql

create table public.webinars (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  title             text not null,
  description       text,
  video_url         text not null,
  duration_seconds  int  not null,
  available_times   jsonb not null default '[]'::jsonb,
  timezone          text not null default 'America/Sao_Paulo',
  status            text not null default 'active',
  created_at        timestamptz not null default now()
);

create table public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  webinar_id   uuid not null references public.webinars(id) on delete cascade,
  at_seconds   int  not null,
  author_name  text not null,
  message      text not null
);
create index chat_messages_webinar_at_idx
  on public.chat_messages (webinar_id, at_seconds);

create table public.offers (
  id               uuid primary key default gen_random_uuid(),
  webinar_id       uuid not null references public.webinars(id) on delete cascade,
  title            text not null,
  body             text,
  cta_label        text not null,
  cta_url          text not null,
  show_at_seconds  int  not null,
  hide_at_seconds  int
);
create index offers_webinar_idx on public.offers (webinar_id);

create table public.registrations (
  id                  uuid primary key default gen_random_uuid(),
  webinar_id          uuid not null references public.webinars(id) on delete cascade,
  name                text not null,
  email               text not null,
  scheduled_start_at  timestamptz not null,
  timezone            text not null default 'America/Sao_Paulo',
  access_token        uuid not null unique default gen_random_uuid(),
  created_at          timestamptz not null default now()
);
create index registrations_webinar_idx on public.registrations (webinar_id);

-- RLS: ligado, sem políticas públicas. Todo acesso é server-side (service role),
-- que ignora RLS. Isso impede leitura anônima direta das tabelas.
alter table public.webinars       enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.offers         enable row level security;
alter table public.registrations  enable row level security;
```

> Quando, na fase 2, expor leitura direta ao browser (anon), criar políticas específicas
> (ex.: permitir `select` de `webinars` com `status='active'`). No MVP não precisa.

---

## Seed de teste

Salvar como `supabase/seed.sql` (ajuste o `video_url` pro seu arquivo):

```sql
-- seed.sql
insert into public.webinars (id, slug, title, description, video_url, duration_seconds, available_times, timezone)
values (
  '00000000-0000-0000-0000-000000000001',
  'aula-demo',
  'Aula Demonstrativa AutoWebinar',
  'Webinar de teste do simulated live.',
  '/videos/aula.mp4',
  600,                                   -- 10 minutos
  '["09:00","14:00","20:00"]'::jsonb,
  'America/Sao_Paulo'
);

insert into public.chat_messages (webinar_id, at_seconds, author_name, message) values
  ('00000000-0000-0000-0000-000000000001',  5,  'Ana Souza',    'Boa noite, chegando agora!'),
  ('00000000-0000-0000-0000-000000000001', 20,  'Carlos M.',    'Som e imagem perfeitos 👏'),
  ('00000000-0000-0000-0000-000000000001', 45,  'Juliana R.',   'Essa parte é ouro!'),
  ('00000000-0000-0000-0000-000000000001', 120, 'Pedro L.',     'Já quero a oferta 🔥');

insert into public.offers (webinar_id, title, body, cta_label, cta_url, show_at_seconds, hide_at_seconds) values
  ('00000000-0000-0000-0000-000000000001',
   'Oferta especial da aula',
   'Condição liberada só durante o webinar.',
   'Quero me inscrever agora',
   'https://exemplo.com/checkout',
   60, 300);
```

Coloque um MP4 de teste em `public/videos/aula.mp4` (qualquer vídeo de ~10 min serve no dev).
