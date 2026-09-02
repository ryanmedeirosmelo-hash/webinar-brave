-- A continuidade é uma decisão editorial de cada webinar. Mantemos desligada
-- por padrão para que webinars existentes conservem a cronologia ao vivo.
alter table public.webinars
  add column if not exists resume_progress_enabled boolean not null default false;
