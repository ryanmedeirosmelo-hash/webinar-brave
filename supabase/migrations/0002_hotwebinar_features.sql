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
