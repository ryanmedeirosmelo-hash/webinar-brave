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

-- O app acessa tudo server-side com a service_role (que tem BYPASSRLS).
-- Nesta versão do Supabase os grants não são automáticos, então concedemos
-- explicitamente. anon/authenticated NÃO recebem nada → sem leitura anônima.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
