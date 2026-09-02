# 05 — Lógica do Simulated Live (o coração)

Este é o documento mais importante. Aqui mora a "mágica". O código abaixo é **referência
funcional** — pode colar e ajustar nomes/estilo.

## Princípio

Há duas referências de tempo, com responsabilidades diferentes:

```
scheduled_start_at  → abre a sala no horário certo
video.currentTime   → controla vídeo, chat e ofertas da própria pessoa
```

- Antes de `scheduled_start_at`, a pessoa vê a contagem regressiva.
- Ao entrar depois do horário, o vídeo começa em `0` — não no minuto em que a turma já está.
- `currentTime` é salvo no navegador a cada segundo e no servidor a cada 20 segundos.
- Ao voltar, o maior ponto salvo é aplicado uma única vez; não há sincronização periódica com
  o relógio global.
- Ao chegar ao fim do vídeo, o link mostra a tela de encerramento e não permite replay.

Exemplo: sessão às 8:00, entrada às 8:05. A aula inicia em 00:00. Se a pessoa sai em 20:14
e retorna, a reprodução volta para 20:14 (ou, em outro aparelho, ao último heartbeat salvo).

## Cuidados que evitam bug

1. **Bloquear seek/pause**: o usuário não pode adiantar/atrasar. Se ele tentar, o player
   continua reproduzindo o ponto individual já alcançado.
2. **Persistir antes de depender da rede**: `localStorage` preserva os últimos segundos mesmo
   se a aba fechar antes do próximo heartbeat; `watch_sessions.last_position_seconds` permite
   retomar pelo link em outro aparelho.
3. **Autoplay com som é bloqueado pelos browsers**: comece **mutado** e mostre um botão
   "🔊 Ativar som" (1 clique do usuário libera o áudio). Padrão de todo player de webinar.
4. **Latência de carregamento**: ao receber `canplay`, posicionamos uma vez no progresso salvo
   e então deixamos o vídeo avançar normalmente.
5. **Fuso**: nunca calcule com horário local "string". Use os timestamps em ms (UTC).

---

## Helper de tempo — `src/lib/time.ts`

```ts
import { fromZonedTime } from "date-fns-tz";

/** Monta o instante UTC a partir de "2026-06-16" + "20:00" num fuso. */
export function buildScheduledStartAt(date: string, time: string, timezone: string): Date {
  // date: "YYYY-MM-DD", time: "HH:mm"
  const localIso = `${date}T${time}:00`;
  return fromZonedTime(localIso, timezone); // retorna Date em UTC
}

/** Segundos decorridos desde o início agendado (pode ser negativo). */
export function elapsedSeconds(scheduledStartAtIso: string, nowMs = Date.now()): number {
  const start = new Date(scheduledStartAtIso).getTime();
  return (nowMs - start) / 1000;
}
```

---

## Componente principal — `src/components/LivePlayer.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { elapsedSeconds } from "@/lib/time";
import { SimulatedChat } from "./SimulatedChat";
import { TimedOffer } from "./TimedOffer";

type ChatMessage = { id: string; at_seconds: number; author_name: string; message: string };
type Offer = {
  id: string; title: string; body: string | null;
  cta_label: string; cta_url: string;
  show_at_seconds: number; hide_at_seconds: number | null;
};

type Props = {
  videoUrl: string;
  durationSeconds: number;
  scheduledStartAtIso: string;
  messages: ChatMessage[];
  offers: Offer[];
};

type Phase = "before" | "live" | "ended";

export function LivePlayer({
  videoUrl, durationSeconds, scheduledStartAtIso, messages, offers,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>(() =>
    elapsedSeconds(scheduledStartAtIso) < 0 ? "before" : "live"
  );
  const [muted, setMuted] = useState(true);

  // O relógio só controla a contagem regressiva; nunca reposiciona o vídeo.
  useEffect(() => {
    const tick = () => {
      const e = elapsedSeconds(scheduledStartAtIso);
      if (e < 0) setPhase("before");
      else setPhase((current) => current === "ended" ? current : "live");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledStartAtIso, durationSeconds]);

  // Restaura uma única vez o ponto salvo e acompanha o vídeo real.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase !== "live") return;

    const saved = Number(localStorage.getItem("watch-position") ?? 0);
    const onCanPlay = () => { video.currentTime = saved; video.play().catch(() => {}); };
    video.addEventListener("canplay", onCanPlay);

    // bloquear pause e seek manual
    const onPause = () => { if (phase === "live") video.play().catch(() => {}); };
    video.addEventListener("pause", onPause);

    if (video.readyState >= 3) onCanPlay(); // já pronto

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [phase, scheduledStartAtIso]);

  if (phase === "before") {
    const remaining = Math.max(0, Math.ceil(-elapsed));
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    return (
      <div className="countdown">
        <h2>Sua sessão começa em</h2>
        <p className="text-5xl font-bold">{mm}:{ss}</p>
        <p>Não feche esta página — o vídeo começa sozinho.</p>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="ended">
        <h2>Esta sessão já foi encerrada.</h2>
        {/* Fase 2: botão de replay aqui */}
      </div>
    );
  }

  // phase === "live"
  return (
    <div className="live-layout">
      <div className="player">
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          muted={muted}
          playsInline
          // sem `controls`: o usuário não controla nada
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onTimeUpdate={(event) => {
            const position = event.currentTarget.currentTime;
            localStorage.setItem("watch-position", String(Math.floor(position)));
            setElapsed(position);
          }}
          onEnded={() => setPhase("ended")}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: "100%", pointerEvents: "none" }}
        />
        {muted && (
          <button className="unmute" onClick={() => {
            setMuted(false);
            videoRef.current?.play().catch(() => {});
          }}>
            🔊 Ativar som
          </button>
        )}
        <TimedOffer offers={offers} elapsed={elapsed} />
      </div>
      <SimulatedChat messages={messages} elapsed={elapsed} />
    </div>
  );
}
```

---

## Chat simulado — `src/components/SimulatedChat.tsx`

```tsx
"use client";
import { useEffect, useRef } from "react";

type ChatMessage = { id: string; at_seconds: number; author_name: string; message: string };

export function SimulatedChat({ messages, elapsed }: { messages: ChatMessage[]; elapsed: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const visible = messages
    .filter((m) => m.at_seconds <= elapsed)
    .sort((a, b) => a.at_seconds - b.at_seconds);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight; // auto-scroll
  }, [visible.length]);

  return (
    <div ref={boxRef} className="chat-box">
      {visible.map((m) => (
        <div key={m.id} className="chat-msg">
          <strong>{m.author_name}:</strong> {m.message}
        </div>
      ))}
    </div>
  );
}
```

> O chat é **read-only** no MVP (só mensagens programadas aparecendo). Campo pra digitar e
> respostas "fake ao vivo" entram na fase 2 se quiser.

---

## Oferta cronometrada — `src/components/TimedOffer.tsx`

```tsx
"use client";

type Offer = {
  id: string; title: string; body: string | null;
  cta_label: string; cta_url: string;
  show_at_seconds: number; hide_at_seconds: number | null;
};

export function TimedOffer({ offers, elapsed }: { offers: Offer[]; elapsed: number }) {
  const active = offers.find(
    (o) => elapsed >= o.show_at_seconds && (o.hide_at_seconds == null || elapsed < o.hide_at_seconds)
  );
  if (!active) return null;

  return (
    <div className="offer-banner">
      <div>
        <strong>{active.title}</strong>
        {active.body && <p>{active.body}</p>}
      </div>
      <a href={active.cta_url} target="_blank" rel="noopener noreferrer" className="offer-cta">
        {active.cta_label}
      </a>
    </div>
  );
}
```

---

## Como testar a sincronia (manual)

1. Inscreva-se com horário = **agora + 1 min**.
2. Abra `/watch/<token>` → veja a contagem `00:59 → 00:00`.
3. Ao zerar, o vídeo começa mutado em 00:00; clique em **Ativar som**.
4. Aguarde ~30s e feche/reabra a página → o vídeo deve voltar para ~30s, não para o minuto
   global da turma nem para o início.
5. Confira que chat e oferta usam os mesmos ~30s individuais.
6. Confira o chat surgindo em 5s/20s/45s e a oferta entre 60s–300s.
