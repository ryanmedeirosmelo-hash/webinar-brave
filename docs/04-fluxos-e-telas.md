# 04 — Fluxos e Telas

## Mapa de rotas

| Rota | Tipo | O que faz |
|------|------|-----------|
| `/<slug>` | Server Component | Landing + formulário de inscrição do webinar |
| Server Action `createRegistration` | mutação | Valida, salva inscrição, redireciona pra `/watch/<token>` |
| `/watch/<token>` | Server Component | Carrega inscrição + webinar + chat + ofertas e renderiza o player |

(Painel admin fica pra fase 2 — no MVP cadastramos via seed SQL.)

---

## Tela 1 — Inscrição (`/<slug>`)

**Objetivo:** capturar nome + e-mail + dia e horário escolhidos.

Campos do formulário:
- Nome (texto, obrigatório)
- E-mail (e-mail, obrigatório)
- **Dia** (date picker — hoje em diante)
- **Horário** (select com os `available_times` do webinar)

Comportamento:
1. Server Component busca `webinar` pelo `slug`. Se não existe ou `status != active` → 404.
2. Renderiza `SignupForm` passando `available_times` e `timezone`.
3. Ao enviar, chama a Server Action `createRegistration`.

> Dica de UX (opcional no MVP): além dos horários fixos, oferecer um botão
> **"Próxima sessão (começa em 15 min)"** que cria um `scheduled_start_at = agora + 15min`.
> É o padrão "just-in-time" que mais converte em webinar evergreen.

---

## Server Action — `createRegistration`

Passos:
1. Validar payload com Zod (`name`, `email`, `webinarId`, `date`, `time`).
2. Montar o instante local (`date` + `time` no `timezone` do webinar) e **converter pra UTC**
   → `scheduled_start_at`. (Usar `date-fns-tz` `fromZonedTime`.)
3. `insert` em `registrations` (o `access_token` é gerado pelo default do banco).
4. Retornar/`redirect` pra `/watch/<access_token>`.

Validações de borda:
- Não permitir horário no passado (a não ser que você queira permitir pra testar).
- `email` em formato válido.

---

## Tela 2 — Assistir (`/watch/<token>`)

**Server Component** (`watch/[token]/page.tsx`):
1. Busca `registration` pelo `access_token`. Se não existe → 404.
2. Busca o `webinar`, suas `chat_messages` (ordenadas por `at_seconds`) e `offers`.
3. Passa tudo pro client component `LivePlayer` (ver doc 05).

**`LivePlayer`** decide um de 3 estados a partir de `elapsed = agora - scheduled_start_at`:

| Estado | Condição | UI |
|--------|----------|-----|
| **Antes** | `elapsed < 0` | Contagem regressiva ("Sua sessão começa em 03:12"). Auto-entra no "Durante" ao zerar. |
| **Durante** | `0 ≤ elapsed < duration` | `<video>` tocando, sincronizado no segundo `elapsed`. Chat + ofertas ativos. Sem controles. |
| **Depois** | `elapsed ≥ duration` | "Esta sessão já foi encerrada." (Fase 2: oferecer replay.) |

Layout sugerido da tela "Durante":
```
┌───────────────────────────────┬───────────────┐
│                               │  CHAT          │
│        VÍDEO (16:9)           │  Ana: ...      │
│   (sem barra de controles)    │  Carlos: ...   │
│                               │  ...           │
│   [ OFERTA aparece aqui ]      │  (auto-scroll) │
└───────────────────────────────┴───────────────┘
```

A **oferta** pode aparecer como faixa abaixo do vídeo ou card sobreposto — escolha do dev.
Aparece quando `currentTime >= show_at_seconds` e some quando `>= hide_at_seconds`.

---

## Fluxo completo (happy path)

```
Pessoa → /aula-demo
       → preenche nome/email, escolhe "hoje 20:00"
       → [createRegistration] salva scheduled_start_at (UTC) + gera token
       → redirect /watch/<token>
       → 19:55: vê contagem regressiva "começa em 05:00"
       → 20:00: vídeo inicia sozinho do segundo 0
       → 20:03: recarrega a página → vídeo retoma no segundo ~180 (não reinicia)
       → chat e oferta aparecem nos tempos certos
       → 20:10: vídeo acaba → tela "encerrado"
```
