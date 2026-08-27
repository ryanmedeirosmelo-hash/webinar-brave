# 01 — Conceito e Escopo

## O que é um "webinar automático" (simulated live)

Um vídeo **gravado uma única vez** que é exibido para cada inscrito **como se fosse ao vivo**:

- A pessoa escolhe um horário (ex.: hoje 20:00).
- Às 20:00 o vídeo começa **automaticamente do início**.
- Se ela entrar às 20:07, o player **já está no minuto 7** — não dá pra voltar nem pausar.
- Durante a exibição, mensagens de "chat" e ofertas aparecem em momentos pré-programados,
  reforçando a sensação de evento ao vivo.
- Quando o vídeo acaba, a sessão é encerrada.

Isso é o que diferencia de um "vídeo normal liberado por link": a **âncora de tempo** é o
horário escolhido pela pessoa, não o play dela.

## Conceitos / vocabulário do projeto

| Termo | Significado |
|-------|-------------|
| **Webinar** | O produto: 1 vídeo + sua duração + suas mensagens/ofertas. |
| **Matrícula / Inscrição** (`registration`) | Uma pessoa que se inscreveu e escolheu data+hora. |
| **`scheduled_start_at`** | O instante exato (data + hora, com fuso) em que o vídeo "começa ao vivo" para aquela inscrição. |
| **Token de acesso** | UUID único na URL de assistir (`/watch/<token>`), identifica a inscrição sem login. |
| **`at_seconds`** | Em que segundo do vídeo um chat/oferta deve aparecer. |
| **Simulated live** | A lógica de sincronizar o player pelo `scheduled_start_at`. |

## Escopo do MVP (o que DEVE funcionar)

1. **Página de inscrição** pública por webinar (`/<slug>`): nome, e-mail, escolha de **dia + horário**.
2. **Persistência**: salvar a inscrição com `scheduled_start_at` e gerar `access_token`.
3. **Página de assistir** (`/watch/<token>`) com a lógica **simulated live** completa:
   - contagem regressiva se ainda não chegou a hora;
   - vídeo sincronizado no segundo certo se já começou;
   - tela de "encerrado" se já passou da duração.
4. **Chat simulado**: mensagens que surgem conforme o tempo do vídeo.
5. **Ofertas/CTAs cronometrados**: bloco/botão que aparece e some em segundos definidos.

> Conteúdo de teste (1 webinar, mensagens e ofertas) pode ser inserido via **SQL seed** —
> não precisamos de painel admin no MVP.

## Explicitamente FORA do MVP (fase 2+)

- E-mail de confirmação e lembrete (Resend + QStash) — fácil de plugar depois.
- Replay / "assistir gravação" após o fim.
- Painel administrativo (CRUD de webinars, mensagens, ofertas, relatórios).
- Multi-cliente / multi-tenant (cada cliente com seus webinars isolados).
- Proteção de download do vídeo (HLS/DRM, ex. Cloudflare Stream/Mux).
- Métricas de presença, taxa de conversão, integração com checkout.

## Critério de pronto do MVP

Conseguir, **localmente**:
1. Abrir `/<slug>`, se inscrever escolhendo um horário daqui a 2 minutos.
2. Abrir o link `/watch/<token>` e ver a contagem regressiva.
3. Quando chega a hora, o vídeo inicia sozinho; ao recarregar a página, ele **retoma no
   segundo correto** (não recomeça).
4. Ver pelo menos 1 mensagem de chat e 1 oferta aparecerem nos tempos programados.
