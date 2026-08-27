-- A função é executada exclusivamente pelo service_role, mas o caminho de busca
-- também deve ser determinístico para evitar a resolução de objetos manipuláveis.
alter function public.record_watch_beat(jsonb)
  set search_path = '';
