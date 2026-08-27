-- seed.sql — webinar de teste do simulated live
-- Tunado para um vídeo de teste de ~120s (public/videos/aula.mp4).

insert into public.webinars (id, slug, title, internal_name, description, video_url, duration_seconds, available_times, timezone,
                             type, jit_interval_minutes, audience_enabled, audience_mode, audience_base,
                             language, presenter_name)
values (
  '00000000-0000-0000-0000-000000000001',
  'aula-demo',
  'Aula Demonstrativa AutoWebinar',
  'Webinar Demo (interno)',
  'Webinar de teste do simulated live.',
  '/videos/aula.mp4',
  120,                                   -- 2 minutos (casa com o vídeo de teste)
  '["09:00","14:00","20:00"]'::jsonb,
  'America/Sao_Paulo',
  'just_in_time', 15, true, 'dynamic', 180,
  'pt-BR', 'Ana Ribeiro'
);

-- Chat fictício denso, espalhado pelos 120s, pra dar sensação de evento ao vivo.
insert into public.chat_messages (webinar_id, at_seconds, author_name, message) values
  ('00000000-0000-0000-0000-000000000001',  2,  'Ana Souza',     'Boa noite, chegando agora!'),
  ('00000000-0000-0000-0000-000000000001',  6,  'Carlos M.',     'Som e imagem perfeitos 👏'),
  ('00000000-0000-0000-0000-000000000001', 11,  'Juliana R.',    'De onde vocês estão assistindo? SP aqui!'),
  ('00000000-0000-0000-0000-000000000001', 15,  'Marcos Lima',   'Curitiba presente 🙌'),
  ('00000000-0000-0000-0000-000000000001', 22,  'Bia Fernandes', 'Essa parte é ouro!'),
  ('00000000-0000-0000-0000-000000000001', 28,  'Rafael T.',     'Anotando tudo aqui ✍️'),
  ('00000000-0000-0000-0000-000000000001', 35,  'Pedro L.',      'Já quero a oferta 🔥'),
  ('00000000-0000-0000-0000-000000000001', 42,  'Larissa',       'Faz sentido demais'),
  ('00000000-0000-0000-0000-000000000001', 50,  'Diego Alves',   'Comprei! valeu demais'),
  ('00000000-0000-0000-0000-000000000001', 58,  'Camila S.',     'O link da oferta tá aí em cima 👆'),
  ('00000000-0000-0000-0000-000000000001', 70,  'Thiago',        'Melhor aula que já vi sobre isso'),
  ('00000000-0000-0000-0000-000000000001', 85,  'Patrícia',      'Garanti a minha vaga ✅'),
  ('00000000-0000-0000-0000-000000000001', 100, 'Gustavo R.',    'Vale cada centavo'),
  ('00000000-0000-0000-0000-000000000001', 112, 'Fernanda',      'Obrigada pela aula! 🙏');

-- Ofertas / botões de compra cronometrados (aparecem e somem).
insert into public.offers (webinar_id, title, body, cta_label, cta_url, show_at_seconds, hide_at_seconds,
                           original_price, offer_price) values
  ('00000000-0000-0000-0000-000000000001',
   'Oferta especial da aula',
   'Condição liberada só durante o webinar — por tempo limitado.',
   'Quero me inscrever agora',
   'https://exemplo.com/checkout',
   30, 90, 497.00, 197.00),
  ('00000000-0000-0000-0000-000000000001',
   '⏰ Últimos minutos!',
   'A oferta encerra junto com a aula. Garanta sua vaga.',
   'Garantir minha vaga',
   'https://exemplo.com/checkout',
   95, NULL, 497.00, 197.00);

-- Notificações de venda (efeito manada) que aparecem no chat.
insert into public.sales_notifications (webinar_id, at_seconds, buyer_name, buyer_city) values
  ('00000000-0000-0000-0000-000000000001', 38,  'Mariana A.',  'São Paulo, SP'),
  ('00000000-0000-0000-0000-000000000001', 52,  'Rodrigo P.',  'Belo Horizonte, MG'),
  ('00000000-0000-0000-0000-000000000001', 67,  'Aline C.',    'Curitiba, PR'),
  ('00000000-0000-0000-0000-000000000001', 80,  'Felipe N.',   'Porto Alegre, RS'),
  ('00000000-0000-0000-0000-000000000001', 104, 'Tatiane M.',  'Recife, PE');
