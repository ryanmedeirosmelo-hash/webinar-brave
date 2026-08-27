# 07 — Roadmap de Execução (checklist)

Ordem recomendada de desenvolvimento. Cada fase entrega algo testável.

## Fase 0 — Setup (≈ meio dia)
- [ ] Criar projeto Next.js + instalar deps (doc 06, passos 1–2)
- [ ] Subir Supabase local (`npx supabase start`)
- [ ] Criar `0001_init.sql` (doc 03) e rodar `npx supabase db reset`
- [ ] Conferir as 4 tabelas no Studio
- [ ] Colar `seed.sql` + MP4 de teste em `public/videos/aula.mp4`
- [ ] Configurar `.env.local` + `src/lib/supabase/server.ts`
- [ ] `pnpm dev` sobe sem erro

## Fase 1 — Inscrição (≈ 1 dia)
- [ ] `src/lib/schemas.ts` com Zod (`registrationSchema`)
- [ ] `src/lib/time.ts` (`buildScheduledStartAt`, `elapsedSeconds`)
- [ ] `/[slug]/page.tsx`: busca webinar pelo slug (404 se inativo)
- [ ] `SignupForm.tsx`: nome, e-mail, dia, horário (`available_times`)
- [ ] Server Action `createRegistration`: valida → calcula UTC → insere → redirect `/watch/<token>`
- [ ] **Teste:** inscrição salva no banco com `scheduled_start_at` correto (conferir no Studio)

## Fase 2 — Player simulated live (≈ 2 dias — núcleo)
- [ ] `/watch/[token]/page.tsx`: carrega registration + webinar + messages + offers
- [ ] `LivePlayer.tsx`: relógio mestre + 3 fases (before/live/ended) (doc 05)
- [ ] Seek inicial no `canplay` + correção de drift a cada 5s
- [ ] Bloqueio de pause/seek + autoplay mutado + botão "Ativar som"
- [ ] **Teste:** recarregar a página retoma no segundo certo (não reinicia)

## Fase 3 — Chat + Ofertas (≈ 1 dia)
- [ ] `SimulatedChat.tsx`: mensagens aparecem por `at_seconds` + auto-scroll
- [ ] `TimedOffer.tsx`: oferta aparece/some por `show/hide_at_seconds`
- [ ] Layout final da tela "live" (vídeo + chat lado a lado, oferta abaixo)
- [ ] **Teste:** chat em 5/20/45s e oferta em 60–300s batem com o vídeo

## Fase 4 — Acabamento do MVP (≈ 1 dia)
- [ ] Estados de erro/404 bonitos (token inválido, webinar inexistente)
- [ ] Responsivo (mobile: chat embaixo do vídeo)
- [ ] Validar "horário no passado" no formulário
- [ ] Texto/UX da contagem regressiva e da tela "encerrado"
- [ ] **Critério de pronto do MVP atingido** (ver doc 01)

---

## Fase 5+ — Pós-MVP (priorizar depois com o cliente)
- [ ] **E-mail**: confirmação na inscrição + lembrete X min antes (Resend + QStash)
- [ ] **Replay**: liberar gravação após o fim (com/sem prazo)
- [ ] **Painel admin**: CRUD de webinars, mensagens, ofertas; ver inscritos
- [ ] **Multi-cliente (multi-tenant)**: cada cliente com seus webinars isolados + RLS por tenant
- [ ] **Proteção do vídeo**: migrar pra HLS (Cloudflare Stream/Mux) contra download
- [ ] **Métricas**: presença, tempo assistido, cliques na oferta, conversão
- [ ] **Deploy**: Vercel + Supabase Cloud

---

## Estimativa total do MVP
≈ **5–6 dias** de um dev focado. O risco/esforço maior está na **Fase 2** (player) — é onde
ele deve gastar mais atenção e onde o doc 05 já entrega o código de referência.

## Decisões a confirmar com o cliente antes de produção
- Horários: fixos (lista) vs. "próxima sessão em X min" (just-in-time) vs. ambos?
- Permitir mais de uma inscrição por e-mail?
- O que acontece se a pessoa perde a sessão — pode reagendar? Replay?
- Vídeo precisa de proteção contra download desde o início?
