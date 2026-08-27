-- Métricas: cliques no CTA da oferta (base da taxa de conversão play→checkout).
-- 1 linha por clique; a conversão conta espectadores DISTINTOS (viewer_key,
-- mesmo formato do watch_sessions: "<reg_id>:<iso>" ou "anon:<uuid>:<iso>").

create table if not exists offer_clicks (
  id            uuid primary key default gen_random_uuid(),
  webinar_id    uuid not null references webinars(id) on delete cascade,
  offer_id      uuid references offers(id) on delete set null,
  viewer_key    text not null,
  session_start timestamptz,
  clicked_at    timestamptz not null default now()
);

create index if not exists offer_clicks_webinar_session_idx
  on offer_clicks (webinar_id, session_start);

alter table offer_clicks enable row level security;
-- sem policy: acesso só server-side via service_role (BYPASSRLS).
grant select, insert, update, delete on offer_clicks to service_role;
