-- Métricas: localização (país/região/cidade) e aparelho de cada espectador.
-- Geo vem dos headers da Vercel (x-vercel-ip-*); aparelho/navegador do user-agent.
-- Tudo capturado no servidor a cada heartbeat — sem API externa, sem inscrição.

alter table watch_sessions add column if not exists country text;
alter table watch_sessions add column if not exists region  text;
alter table watch_sessions add column if not exists city    text;
alter table watch_sessions add column if not exists device  text;  -- Celular/Computador/Tablet
alter table watch_sessions add column if not exists os      text;
alter table watch_sessions add column if not exists browser text;
