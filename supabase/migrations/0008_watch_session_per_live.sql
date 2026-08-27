-- Métricas por SESSÃO (cada dia/horário de live conta separado), em vez de um
-- acumulado eterno por webinar. Cada heartbeat passa a gravar o início da sessão
-- que o espectador está assistindo (scheduledStart). O viewer_key novo embute a
-- sessão → o mesmo navegador gera 1 linha por live (não reaproveita entre dias).

alter table watch_sessions add column if not exists session_start timestamptz;
create index if not exists watch_sessions_session_idx
  on watch_sessions (webinar_id, session_start);

-- (Instalação nova não precisa de backfill: sem session_start, a linha antiga
-- simplesmente não entra em nenhuma sessão. Se você já tinha dados, preencha
-- session_start com o horário da live correspondente.)
