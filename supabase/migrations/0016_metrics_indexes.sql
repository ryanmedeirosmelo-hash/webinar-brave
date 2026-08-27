-- Após a migração para viewer_key, a sessão deixou de ter chave primária.
-- Esse identificador já é único e não nulo, portanto também é sua chave estável.
alter table public.watch_sessions
  drop constraint watch_sessions_viewer_key_key,
  add primary key (viewer_key);

-- O Postgres não cria índices automaticamente para FKs. Eles evitam varreduras
-- completas em joins e nas ações de cascade/set null relacionadas.
create index if not exists watch_sessions_registration_id_idx
  on public.watch_sessions (registration_id);

create index if not exists offer_clicks_offer_id_idx
  on public.offer_clicks (offer_id);
