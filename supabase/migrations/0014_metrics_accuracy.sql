-- Precisão das métricas: presença REAL minuto a minuto + posição monotônica.
--
-- Problema do modelo anterior: cada espectador virava um intervalo
-- (first_seen_at → last_seen_at) e a retenção/pico assumia presença CONTÍNUA
-- entre as duas pontas. Quem saía no minuto 10 e voltava no 50 era contado como
-- presente a live inteira. Além disso, o upsert sobrescrevia
-- last_position_seconds — um heartbeat fora de ordem (reload, aba dormindo,
-- rede lenta) podia BAIXAR a posição e derrubar o "até o fim".
--
-- Agora cada heartbeat carimba o minuto da live em `minutes` (sem duplicar) e a
-- posição só sobe (greatest). Linhas antigas ficam com `minutes` vazio: a
-- leitura cai no modelo de intervalo pra não zerar o histórico.

alter table watch_sessions
  add column if not exists minutes int[] not null default '{}'::int[];

-- Um heartbeat = uma chamada. Insere ou atualiza a linha do espectador daquela
-- live, marca o minuto assistido e nunca regride a posição.
create or replace function public.record_watch_beat(p jsonb)
returns void
language plpgsql
as $$
declare
  v_minute int := nullif(p->>'minute', '')::int;
  v_seed   int[] := case when v_minute is null then '{}'::int[] else array[v_minute] end;
begin
  insert into public.watch_sessions as w (
    viewer_key, webinar_id, registration_id, anon_id, session_start,
    last_seen_at, last_position_seconds, minutes,
    country, region, city, device, os, browser
  ) values (
    p->>'viewer_key',
    (p->>'webinar_id')::uuid,
    nullif(p->>'registration_id', '')::uuid,
    nullif(p->>'anon_id', ''),
    nullif(p->>'session_start', '')::timestamptz,
    now(),
    greatest(coalesce((p->>'position_seconds')::int, 0), 0),
    v_seed,
    nullif(p->>'country', ''),
    nullif(p->>'region', ''),
    nullif(p->>'city', ''),
    nullif(p->>'device', ''),
    nullif(p->>'os', ''),
    nullif(p->>'browser', '')
  )
  on conflict (viewer_key) do update set
    last_seen_at          = now(),
    -- posição é monotônica: heartbeat atrasado não derruba o "até o fim"
    last_position_seconds = greatest(w.last_position_seconds, excluded.last_position_seconds),
    -- a sessão/identidade da 1ª batida manda (viewer_key já embute a live)
    session_start         = coalesce(w.session_start, excluded.session_start),
    registration_id       = coalesce(w.registration_id, excluded.registration_id),
    anon_id               = coalesce(w.anon_id, excluded.anon_id),
    minutes               = case
                              when v_minute is null then w.minutes
                              when w.minutes @> v_seed then w.minutes
                              else w.minutes || v_minute
                            end,
    -- geo/aparelho: só preenche o que ainda está vazio (não apaga com null)
    country = coalesce(excluded.country, w.country),
    region  = coalesce(excluded.region,  w.region),
    city    = coalesce(excluded.city,    w.city),
    device  = coalesce(excluded.device,  w.device),
    os      = coalesce(excluded.os,      w.os),
    browser = coalesce(excluded.browser, w.browser);
end;
$$;

-- Só o servidor (service_role) grava presença.
revoke all on function public.record_watch_beat(jsonb) from public;
grant execute on function public.record_watch_beat(jsonb) to service_role;
