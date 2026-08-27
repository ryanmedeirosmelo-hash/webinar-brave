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
