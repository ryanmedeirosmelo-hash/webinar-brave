-- 0003_video_storage.sql
-- Upload de vídeo: bucket privado + referência do objeto no webinar.

-- onde fica o objeto no Storage (ex.: "webinar-videos/<id>/aula.mp4").
-- Quando preenchido, o player usa o proxy /v/<id> em vez de video_url.
alter table public.webinars
  add column video_path text;

-- bucket privado p/ os vídeos (servidos via proxy server-side com service_role).
insert into storage.buckets (id, name, public)
values ('webinar-videos', 'webinar-videos', false)
on conflict (id) do nothing;
