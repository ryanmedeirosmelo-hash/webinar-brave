-- 0017_capture_landing.sql
-- Página de captura no layout do print: imagem ao lado do formulário e a
-- faixa de escassez que acompanha a barra de progresso (Etapa 3 — Login).

alter table public.webinars
  add column if not exists capture_image_url    text,
  add column if not exists capture_scarcity_text text;
