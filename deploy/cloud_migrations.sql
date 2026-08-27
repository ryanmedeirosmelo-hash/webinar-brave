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
-- 0002_hotwebinar_features.sql
-- Recursos no estilo HotWebinar: tipo de evento, audiência, oferta rica, notificações de venda.

-- ---- webinars: tipo de evento + contador de audiência ----
alter table public.webinars
  add column type                 text    not null default 'unico'
    check (type in ('unico', 'just_in_time')),
  add column jit_interval_minutes int     not null default 15,  -- só p/ just_in_time
  add column audience_enabled     boolean not null default true,
  add column audience_mode        text    not null default 'dynamic'
    check (audience_mode in ('fixed', 'dynamic')),
  add column audience_base        int     not null default 150; -- nº base de espectadores

-- ---- offers: imagem + preços (botão de compra rico) ----
alter table public.offers
  add column image_url      text,
  add column original_price numeric(10,2),
  add column offer_price    numeric(10,2);

-- ---- sales_notifications: "Fulano acabou de comprar" no chat (efeito manada) ----
create table public.sales_notifications (
  id            uuid primary key default gen_random_uuid(),
  webinar_id    uuid not null references public.webinars(id) on delete cascade,
  at_seconds    int  not null,
  buyer_name    text not null,
  buyer_city    text,
  product_label text not null default 'acabou de garantir a vaga'
);
create index sales_notifications_webinar_at_idx
  on public.sales_notifications (webinar_id, at_seconds);

alter table public.sales_notifications enable row level security;

-- grants p/ a nova tabela (as de 0001 não cobrem tabelas criadas depois)
grant select, insert, update, delete on public.sales_notifications to service_role;
-- 0003_video_storage.sql
-- Upload de vídeo: bucket privado + referência do objeto no webinar.

-- onde fica o objeto no Storage (ex.: "webinar-videos/<id>/aula.mp4").
-- Quando preenchido, o player usa o proxy /v/<id> em vez de video_url.
alter table public.webinars
  add column video_path text;

-- bucket privado p/ os vídeos (servidos via proxy server-side com service_role).
insert into storage.buckets (id, name, public)
values ('webinar-videos', 'webinar-videos', false)
on conflict (id) do nothing;
-- 0004_wizard_inicio.sql
-- Campos da etapa "Início" do wizard (estilo HotWebinar).

alter table public.webinars
  add column internal_name        text,          -- "Nome do webinar" (interno)
  add column language             text not null default 'pt-BR',
  add column presenter_name       text,
  add column presenter_avatar_url text;

-- preenche o nome interno com o título atual nos webinars já existentes
update public.webinars set internal_name = title where internal_name is null;
-- 0005_wizard_full.sql
-- Todos os campos das etapas do wizard (estilo HotWebinar).

-- ---- webinars ----
alter table public.webinars
  -- Etapa 2: Webinar (datas / recorrência / sala de espera)
  add column start_at              timestamptz,
  add column end_at                timestamptz,
  add column recurrence_enabled    boolean not null default false,
  add column recurrence_freq       text    not null default 'weekly',   -- weekly | daily
  add column recurrence_dow        text,                                 -- ex.: "Segunda-feira às 19:15"
  add column waiting_room_enabled  boolean not null default false,
  add column waiting_room_page     text    not null default 'default',   -- default | landing

  -- Etapa 3: Login (página de captura)
  add column logo_url               text,
  add column progress_bar_enabled   boolean not null default true,
  add column progress_start         int     not null default 80,
  add column progress_bar_color     text    not null default '#e11d48',
  add column progress_text_color    text    not null default '#ffffff',
  add column capture_title          text,
  add column capture_button_label   text    not null default 'Assistir Transmissão',
  add column capture_button_color   text    not null default '#16a34a',
  add column capture_button_text_color text not null default '#ffffff',
  add column form_fields            jsonb   not null default
    '[{"key":"name","enabled":true,"required":true,"label":"Como podemos te chamar"},{"key":"email","enabled":true,"required":true,"label":"Insira o e-mail da matrícula"},{"key":"whatsapp","enabled":true,"required":false,"label":"Insira seu WhatsApp"}]'::jsonb,

  -- Etapa 4: Vídeo
  add column video_provider     text    not null default 'upload',  -- upload|vimeo|bunny|mp4|cloudflare|vidyard|wistia|dailymotion
  add column video_external_url text,
  add column video_autoplay     boolean not null default false,
  add column video_fullscreen   boolean not null default true,

  -- Etapa 7: título da notificação de venda
  add column sales_notification_title text,

  -- Etapa 8: Audiência (min/max + botão ao vivo); audience_mode ganha 'none'
  add column audience_min       int     not null default 45,
  add column audience_max       int     not null default 120,
  add column show_live_button   boolean not null default true,

  -- Etapa 9: Integrações (mapa provider -> config)
  add column integrations       jsonb   not null default '{}'::jsonb;

-- audience_mode passa a aceitar 'none' (não exibir)
alter table public.webinars drop constraint if exists webinars_audience_mode_check;
alter table public.webinars add constraint webinars_audience_mode_check
  check (audience_mode in ('fixed', 'dynamic', 'none'));

-- ---- offers (Etapa 5: oferta rica) ----
alter table public.offers
  add column name              text,
  add column image_desktop_url text,
  add column image_mobile_url  text,
  add column button_color      text    not null default '#16a34a',
  add column price_original_text text,
  add column price_offer_text  text,
  add column pitch_start_seconds int   not null default 0,
  add column utm_passthrough    boolean not null default true,
  add column disabled           boolean not null default false,
  add column open_same_window   boolean not null default false,
  add column raffle_enabled     boolean not null default false;

-- bucket público p/ imagens (logo, oferta, avatar)
insert into storage.buckets (id, name, public)
values ('webinar-images', 'webinar-images', true)
on conflict (id) do nothing;

-- ---- 0017: página de captura (imagem + faixa de escassez) ----
alter table public.webinars
  add column if not exists capture_image_url    text,
  add column if not exists capture_scarcity_text text;
