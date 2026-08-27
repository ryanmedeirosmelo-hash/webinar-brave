-- 0004_wizard_inicio.sql
-- Campos da etapa "Início" do wizard (estilo HotWebinar).

alter table public.webinars
  add column internal_name        text,          -- "Nome do webinar" (interno)
  add column language             text not null default 'pt-BR',
  add column presenter_name       text,
  add column presenter_avatar_url text;

-- preenche o nome interno com o título atual nos webinars já existentes
update public.webinars set internal_name = title where internal_name is null;
