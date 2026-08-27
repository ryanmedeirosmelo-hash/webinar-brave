-- Métricas reais do webinar: tracking leve de presença por inscrição.
-- O player "bate ponto" a cada ~20s (upsert). As métricas são derivadas na leitura.

create table if not exists watch_sessions (
  registration_id uuid primary key references registrations(id) on delete cascade,
  webinar_id      uuid not null references webinars(id) on delete cascade,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  -- posição (s) mais alta atingida no vídeo; monotônica no simulated-live
  last_position_seconds int not null default 0
);

create index if not exists watch_sessions_webinar_idx  on watch_sessions (webinar_id);
create index if not exists watch_sessions_last_seen_idx on watch_sessions (last_seen_at);

alter table watch_sessions enable row level security;
-- sem policy: service_role (supabaseAdmin) faz BYPASSRLS, igual às outras tabelas.
