"use client";

import { useEffect, useRef, useState } from "react";
import { elapsedSeconds, postLiveOfferOpen, POST_LIVE_OFFER_UNTIL } from "@/lib/time";
import { recordHeartbeat, recordAnonHeartbeat } from "@/app/actions/heartbeat";
import { SimulatedChat } from "./SimulatedChat";
import { TimedOffer } from "./TimedOffer";
import { SupportBox } from "./SupportBox";
import { displayTitle } from "./Brand";
import {
  HwAvatar,
  HwCountdownScreen,
  HwEndedScreen,
  HwLiveBadge,
  HwPage,
} from "./HwKit";
import type { ChatMessage, Offer, SalesNotification, AudienceMode } from "@/types/db";

type AudienceConfig = { enabled: boolean; mode: AudienceMode; min: number; max: number };

type Props = {
  title: string;
  presenterName?: string | null;
  /** Foto de quem apresenta (webinar.presenter_avatar_url), opcional. */
  presenterAvatarUrl?: string | null;
  /** Marca do webinar (logo/wordmark) exibida no header e nas telas de estado. */
  brandName?: string | null;
  logoUrl?: string | null;
  /** Cor de destaque da marca (bordas do player, contagem regressiva). */
  accentColor?: string | null;
  videoUrl: string;
  durationSeconds: number;
  scheduledStartAtIso: string;
  /** Fuso do webinar — define até que horas a oferta continua na tela de
   *  encerrado (POST_LIVE_OFFER_UNTIL). Sem ele, a tela fica sem oferta. */
  timezone?: string | null;
  messages: ChatMessage[];
  offers: Offer[];
  sales: SalesNotification[];
  salesTitle?: string | null;
  autoplay?: boolean;
  fullscreen?: boolean;
  audience: AudienceConfig;
  /** Token de acesso da inscrição — usado para o heartbeat de métricas. */
  registrationToken?: string | null;
  /** Id do webinar — usado p/ contar quem assiste anônimo (link público sem
   *  inscrição). Sem registrationToken, o heartbeat cai pro modo anônimo. */
  webinarId?: string | null;
  /** Nome do inscrito — usado quando ele comenta no chat. */
  viewerName?: string | null;
  /** Modo admin/teste: libera controles nativos (velocidade, seek) e desliga
   *  a sincronia por relógio. Acionado por ?preview=1 no link. */
  previewMode?: boolean;
  /** Revisão local: sem heartbeat, trava de replay ou tracking de oferta. */
  draftMode?: boolean;
};

type Phase = "before" | "live" | "ended";

/** Segundos de "<apresentador> está se conectando…" no início da transmissão. */
const CONNECTING_SECONDS = 6;

function phaseFor(elapsed: number, duration: number): Phase {
  if (elapsed < 0) return "before";
  if (elapsed >= duration) return "ended";
  return "live";
}

/** Espectadores "ao vivo" fictícios: oscila entre min e max ao longo da aula. */
function fakeViewers(elapsed: number, duration: number, cfg: AudienceConfig) {
  if (elapsed < 0) return 0;
  if (cfg.mode === "fixed") return Math.max(1, cfg.max);
  const span = Math.max(0, cfg.max - cfg.min);
  // sobe rápido no início, segura no topo, cai no fim
  const ramp = Math.min(1, elapsed / 30);
  const tail = Math.max(0.5, 1 - Math.max(0, elapsed - duration * 0.8) / (duration * 0.2));
  const wave = (Math.sin(elapsed / 6) + 1) / 2; // 0..1
  const value = cfg.min + span * (0.6 + 0.4 * wave) * ramp * tail;
  return Math.max(cfg.min, Math.round(value));
}

export function LivePlayer({
  title,
  presenterName,
  presenterAvatarUrl,
  brandName,
  logoUrl,
  accentColor,
  videoUrl,
  durationSeconds,
  scheduledStartAtIso,
  timezone,
  messages,
  offers,
  sales,
  salesTitle,
  autoplay,
  fullscreen,
  audience,
  registrationToken,
  webinarId,
  viewerName,
  previewMode,
  draftMode,
}: Props) {
  void autoplay; // o simulated-live sempre força play; mantido p/ futuras opções
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(() => elapsedSeconds(scheduledStartAtIso));
  const [phaseState, setPhase] = useState<Phase>(() =>
    phaseFor(elapsedSeconds(scheduledStartAtIso), durationSeconds)
  );
  // No preview forçamos "live" para o admin ver o player independente do horário.
  const phase: Phase = previewMode ? "live" : phaseState;
  const [muted, setMuted] = useState(true);
  // Relógio mestre: 1x por segundo recalcula elapsed e a fase.
  useEffect(() => {
    const tick = () => {
      const e = elapsedSeconds(scheduledStartAtIso);
      setElapsed(e);
      setPhase(phaseFor(e, durationSeconds));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledStartAtIso, durationSeconds]);

  // Heartbeat de presença (métricas reais no admin). Não conta no preview.
  // Inscrito → por token; anônimo (link público) → por id de navegador.
  //
  // Só bate ponto quem está DE FATO na aula: fora da janela (antes do início ou
  // depois do fim) e nas telas de "aula encerrada"/replay travado não conta —
  // senão uma aba esquecida aberta viraria play, "até o fim" e "assistindo
  // agora" pra sempre.
  useEffect(() => {
    if (previewMode || draftMode) return;
    if (!registrationToken && !webinarId) return;

    // Anônimo: id estável por navegador (persiste no localStorage).
    let anonId: string | null = null;
    if (!registrationToken) {
      try {
        anonId = localStorage.getItem("aw_vid");
        if (!anonId) {
          anonId = crypto.randomUUID();
          localStorage.setItem("aw_vid", anonId);
        }
      } catch {
        return; // sem storage não há como identificar o espectador anônimo
      }
    }

    const beat = () => {
      const e = elapsedSeconds(scheduledStartAtIso);
      if (e < 0) return; // fase "antes": ainda não entrou na live
      if (durationSeconds > 0 && e >= durationSeconds) return; // aula encerrada
      const pos = Math.min(Math.floor(e), durationSeconds);
      if (registrationToken) {
        recordHeartbeat(registrationToken, pos, scheduledStartAtIso).catch(() => {});
      } else if (webinarId && anonId) {
        recordAnonHeartbeat(webinarId, anonId, pos, scheduledStartAtIso).catch(() => {});
      }
    };
    beat(); // bate na hora que entra
    const id = setInterval(beat, 20000); // e a cada 20s
    return () => clearInterval(id);
  }, [
    registrationToken,
    webinarId,
    scheduledStartAtIso,
    durationSeconds,
    previewMode,
    draftMode,
  ]);

  // Define a fonte do vídeo. Para HLS (.m3u8) preferimos SEMPRE o hls.js (MSE):
  // o HLS "nativo" do Chrome é instável (engasga e falha o áudio). Só usamos o
  // nativo no Safari, onde o suporte a HLS é sólido.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase !== "live" || !videoUrl) return;

    const isHls = /\.m3u8(\?|$)/i.test(videoUrl);
    const isSafari =
      typeof navigator !== "undefined" &&
      /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

    if (isHls && !isSafari) {
      let hls: { destroy: () => void } | null = null;
      let cancelled = false;
      import("hls.js").then(({ default: Hls }) => {
        const v = videoRef.current;
        if (cancelled || !v) return;
        if (Hls.isSupported()) {
          const inst = new Hls({
            enableWorker: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 120,
          });
          inst.loadSource(videoUrl);
          inst.attachMedia(v);
          hls = inst;
        } else {
          v.src = videoUrl; // fallback: HLS nativo
        }
      });
      return () => {
        cancelled = true;
        hls?.destroy();
      };
    }

    // Safari (HLS nativo sólido) ou vídeo não-HLS.
    video.src = videoUrl;
  }, [videoUrl, phase]);

  // Sincroniza o <video> com o elapsed enquanto estiver "live".
  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase !== "live") return;
    // Preview: sem trava de relógio — o admin controla seek/velocidade à vontade.
    if (previewMode) {
      if (video.paused) video.play().catch(() => {});
      return;
    }

    // Sala pode durar mais que o vídeo (fechamento pós-aula): ao passar do
    // fim do vídeo, congela no último quadro em vez de reiniciar do zero.
    const pastVideoEnd = () => {
      const dur = video.duration;
      return (
        Number.isFinite(dur) &&
        dur > 0 &&
        elapsedSeconds(scheduledStartAtIso) >= dur
      );
    };

    const sync = () => {
      if (pastVideoEnd()) {
        if (!video.paused) video.pause();
        return;
      }
      const t = elapsedSeconds(scheduledStartAtIso);
      // Tolerância folgada: re-seeks frequentes causam engasgo. Só corrige a
      // deriva quando ela passa de ~3s.
      if (Math.abs(video.currentTime - t) > 3) {
        video.currentTime = t; // corrige deriva
      }
      if (video.paused) video.play().catch(() => {});
    };

    // Posiciona no instante "ao vivo" apenas uma vez (no primeiro canplay).
    // Re-seekar a cada canplay (que dispara após cada rebuffer) provoca travadas.
    let positioned = false;
    const onCanPlay = () => {
      if (pastVideoEnd()) return;
      if (!positioned) {
        video.currentTime = elapsedSeconds(scheduledStartAtIso);
        positioned = true;
      }
      if (video.paused) video.play().catch(() => {});
    };
    video.addEventListener("canplay", onCanPlay);

    const driftId = setInterval(sync, 5000);

    // bloquear pause e seek manual (exceto após o fim do vídeo)
    const onPause = () => {
      if (phase === "live" && !pastVideoEnd()) video.play().catch(() => {});
    };
    const onSeeking = () => {
      if (pastVideoEnd()) return;
      const t = elapsedSeconds(scheduledStartAtIso);
      if (Math.abs(video.currentTime - t) > 3) video.currentTime = t;
    };
    video.addEventListener("pause", onPause);
    video.addEventListener("seeking", onSeeking);

    if (video.readyState >= 3) onCanPlay();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeking", onSeeking);
      clearInterval(driftId);
    };
  }, [phase, scheduledStartAtIso, previewMode]);

  void accentColor; // cores vêm do tema do player (vermelho/branco)
  const brand = brandName || presenterName || title;
  const shownTitle = displayTitle(title);

  const shell = (content: React.ReactNode, live?: boolean) => (
    <HwPage logoUrl={logoUrl} brandName={brand} presenterName={presenterName} live={live}>
      {content}
    </HwPage>
  );

  // ---------- ENCERRADO ----------
  // A inscrição fixa o início da própria sessão; por isso a fase "ended" já
  // impede replay daquele link. Uma trava global no navegador bloquearia a
  // próxima turma Just in Time, que é exatamente o fluxo esperado aqui.
  // A oferta sobrevive ao fim da transmissão até POST_LIVE_OFFER_UNTIL.
  const offerAfterEnd =
    draftMode ||
    (phase === "ended" &&
    !!timezone &&
    postLiveOfferOpen(
      new Date(scheduledStartAtIso).getTime(),
      timezone,
      new Date(scheduledStartAtIso).getTime() + elapsed * 1000
    ));

  const endedScreen = shell(
    <HwEndedScreen
      title={shownTitle}
      note="A transmissão não fica disponível para reapresentação. Fique de olho no seu e-mail para a próxima turma."
      offerNote={`A condição apresentada na aula fica liberada até as ${POST_LIVE_OFFER_UNTIL} de hoje.`}
      offer={
        offerAfterEnd ? (
          <TimedOffer
            offers={offers}
            elapsed={durationSeconds - 1}
            webinarId={webinarId}
            registrationToken={registrationToken}
            sessionStartIso={scheduledStartAtIso}
            previewMode={draftMode}
            forceVisible={draftMode}
            stacked
          />
        ) : null
      }
      /* Suporte só no fim, junto do botão de compra — durante a live o WhatsApp
         tirava o espectador da transmissão. */
      support={<SupportBox />}
    />
  );
  if (phase === "ended" && !previewMode) return endedScreen;

  // ---------- FASE: ANTES (contagem regressiva) ----------
  if (phase === "before") {
    return shell(
      <HwCountdownScreen
        title={shownTitle}
        ms={Math.max(0, -elapsed) * 1000}
        presenterName={presenterName}
        presenterAvatarUrl={presenterAvatarUrl}
      />
    );
  }

  // ---------- FASE: AO VIVO ----------
  const viewers = fakeViewers(elapsed, durationSeconds, audience);
  // Breve "conectando" no início: evita o vídeo estourar seco após a contagem.
  // O vídeo já carrega por trás e é revelado quando o overlay sai.
  const connecting = !previewMode && elapsed < CONNECTING_SECONDS;
  const minutos = Math.max(0, Math.floor(elapsed / 60));

  return shell(
    <div className="mx-auto grid max-w-[1400px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* ---- Coluna do player ---- */}
      <div className="space-y-4">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted={previewMode ? false : muted}
            playsInline
            controls={previewMode}
            controlsList={previewMode ? "nodownload" : "nodownload noplaybackrate"}
            disablePictureInPicture={!fullscreen}
            onContextMenu={(e) => e.preventDefault()}
            className={`h-full w-full object-contain ${previewMode ? "" : "pointer-events-none"}`}
          />
          {!videoUrl && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div className="space-y-2">
                <p className="text-[34px]">🎬</p>
                <p className="text-[15px] font-medium text-white/80">A transmissão vai começar.</p>
                <p className="text-[13px] text-white/50">Fique nesta página.</p>
              </div>
            </div>
          )}

          {/* Selo "AO VIVO" dentro da box — reforça a sensação de transmissão */}
          {videoUrl && !connecting && !previewMode && (
            <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-2">
              <HwLiveBadge />
              {audience.enabled && (
                <span className="rounded-md bg-black/60 px-2 py-1 text-[12px] font-medium text-white backdrop-blur-sm">
                  👁 {viewers}
                </span>
              )}
            </div>
          )}

          {/* Selo de PREVIEW (modo admin/teste) */}
          {videoUrl && previewMode && (
            <div className="pointer-events-none absolute left-3 top-3 z-30">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0f0f0f]">
                ⚙ Preview
              </span>
            </div>
          )}

          {/* "Conectando" no início — revela o vídeo suavemente */}
          {videoUrl && connecting && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-black px-6 text-center">
              <div className="space-y-4">
                <HwLiveBadge />
                <div className="flex items-center justify-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/25 border-t-[var(--hw-red)]" />
                  <p className="text-[17px] font-medium text-white">
                    {presenterName
                      ? `${presenterName} está se conectando…`
                      : "Conectando à transmissão…"}
                  </p>
                </div>
                <p className="text-[14px] text-white/60">Aguarde, já vai começar.</p>
              </div>
            </div>
          )}

          {videoUrl && !connecting && muted && !previewMode && (
            <button
              onClick={() => {
                setMuted(false);
                const v = videoRef.current;
                if (v) {
                  v.muted = false;
                  v.play().catch(() => {});
                }
              }}
              className="absolute inset-0 z-10 grid cursor-pointer place-items-center bg-black/40 backdrop-blur-[1px]"
              aria-label="Ativar som"
            >
              <span className="flex animate-pulse items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[16px] font-bold text-[#0f0f0f] shadow-2xl">
                🔊 Clique para ouvir o áudio
              </span>
            </button>
          )}

        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold leading-snug tracking-tight sm:text-[22px]">
              {shownTitle}
            </h1>
            <p className="mt-1 text-[13px] text-[var(--hw-muted)]">
              {audience.enabled && <>{viewers} assistindo agora · </>}
              {minutos > 0 ? `começou há ${minutos} minuto${minutos > 1 ? "s" : ""}` : "começou agora"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <HwAvatar
              name={presenterName || brand}
              size={40}
              presenterName={presenterName}
              presenterAvatarUrl={presenterAvatarUrl}
            />
            <div className="leading-tight">
              <p className="text-[15px] font-semibold">{presenterName || brand}</p>
              <p className="text-[13px] text-[var(--hw-muted)]">
                {presenterName && brand !== presenterName ? brand : "Quem apresenta"}
              </p>
            </div>
          </div>
        </div>

        <TimedOffer
          offers={offers}
          elapsed={elapsed}
          webinarId={webinarId}
          registrationToken={registrationToken}
          sessionStartIso={scheduledStartAtIso}
          previewMode={previewMode || draftMode}
          forceVisible={draftMode}
        />
      </div>

      {/* Chat — ao lado no desktop, embaixo no mobile. Altura limitada com
          scroll próprio para não empurrar a página nem tirar o vídeo da tela. */}
      <div className="h-[60vh] min-h-[420px] lg:sticky lg:top-[72px] lg:h-[calc(100dvh-96px)]">
        <SimulatedChat
          messages={messages}
          sales={sales}
          salesTitle={salesTitle}
          elapsed={elapsed}
          viewerName={viewerName}
          presenterName={presenterName}
          presenterAvatarUrl={presenterAvatarUrl}
          viewers={audience.enabled ? viewers : null}
        />
      </div>
    </div>,
    true
  );
}
