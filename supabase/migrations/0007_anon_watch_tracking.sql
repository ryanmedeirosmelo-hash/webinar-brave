-- Métricas reais: contar também quem assiste pelo LINK PÚBLICO (sala de espera
-- na própria landing), SEM inscrição por formulário. Cada navegador anônimo
-- bate ponto com um id próprio (gerado no client, guardado no localStorage).
--
-- Identidade do espectador = `viewer_key`:
--   - inscrito  → registration_id (uuid em texto)
--   - anônimo   → 'anon:<uuid-do-navegador>'
-- registration_id deixa de ser obrigatório/PK; viewer_key vira a chave de upsert.

alter table watch_sessions add column if not exists anon_id    text;
alter table watch_sessions add column if not exists viewer_key text;

-- backfill: as linhas existentes eram todas de inscritos
update watch_sessions set viewer_key = registration_id::text where viewer_key is null;

alter table watch_sessions drop constraint if exists watch_sessions_pkey;
alter table watch_sessions alter column registration_id drop not null;
alter table watch_sessions alter column viewer_key set not null;
alter table watch_sessions add constraint watch_sessions_viewer_key_key unique (viewer_key);
