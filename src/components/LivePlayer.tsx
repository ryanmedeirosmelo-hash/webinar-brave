"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { elapsedSeconds, postLiveOfferOpen, POST_LIVE_OFFER_UNTIL } from "@/lib/time";
import {
  getRecordedPlaybackPosition,
  recordHeartbeat,
  recordAnonHeartbeat,
} from "@/app/actions/heartbeat";
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
  /** Ponto já salvo no servidor para esta inscrição/sessão. */
  initialResumeSeconds?: number;
  /** Há registro de que este link já iniciou esta sessão. */
  hasStarted?: boolean;
  /** Libera a continuidade individual configurada neste webinar. */
  resumeProgressEnabled?: boolean;
  /** Id do webinar — usado p/ contar quem assiste anônimo (link público sem
   *  inscrição). Sem registrationToken, o heartbeat cai pro modo anônimo. */
  webinarId?: string | null;
  /** Nome do inscrito — usado quando ele comenta no chat. */
  viewerName?: string | null;
  /** WhatsApp da equipe, configurado na integração deste webinar. */
  supportWhatsapp?: string | null;
  /** Página final própria do webinar, exibida quando a transmissão termina. */
  thankYouPath?: string | null;
  /** Modo admin/teste: libera controles nativos (velocidade, seek) e desliga
   *  a sincronia por relógio. Acionado por ?preview=1 no link. */
  previewMode?: boolean;
  /** Revisão local: sem heartbeat, trava de replay ou tracking de oferta. */
  draftMode?: boolean;
};

type Phase = "before" | "live" | "ended";

/** APIs WebKit de tela cheia, ainda necessárias no Safari mais antigo. Só as
 * usamos no CONTAINER do player: `video.webkitEnterFullscreen` entrega o vídeo
 * ao player nativo do iOS/Safari, que sempre desenha os próprios controles
 * (pausar, barra de progresso, velocidade) — e isso quebra a transmissão
 * simulada, porque o espectador consegue pausar e avançar a aula. */
type WebkitFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/** Segundos de "<apresentador> está se conectando…" no início da transmissão. */
const CONNECTING_SECONDS = 6;

/** Tempo parado até a barra de volume/tela cheia sumir de novo. */
const CONTROLS_IDLE_MS = 2800;

/** Folga aceita entre o vídeo e o ponto da transmissão antes de voltar o
 *  ponteiro. Cobre o "nudge" do hls.js sem deixar passar uma busca real. */
const SEEK_TOLERANCE_SECONDS = 1.5;

/** Atraso tolerado entre o vídeo e o relógio da turma antes de saltar para o
 *  ponto ao vivo. Curto o bastante para a oferta não chegar antes da fala,
 *  largo o bastante para não corrigir a cada engasgo de buffer. */
const DRIFT_TOLERANCE_SECONDS = 2;

function phaseFor(elapsed: number, duration: number): Phase {
  if (elapsed < 0) return "before";
  if (elapsed >= duration) return "ended";
  return "live";
}

function clampPosition(position: number, duration: number) {
  const safe = Number.isFinite(position) ? Math.max(0, position) : 0;
  return duration > 0 ? Math.min(safe, duration) : safe;
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
  initialResumeSeconds = 0,
  hasStarted = false,
  resumeProgressEnabled = false,
  webinarId,
  viewerName,
  supportWhatsapp,
  thankYouPath,
  previewMode,
  draftMode,
}: Props) {
  void autoplay; // o simulated-live sempre força play; mantido p/ futuras opções
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const initialScheduledElapsed = elapsedSeconds(scheduledStartAtIso);
  // Com continuidade ligada, o relógio só libera a entrada na sala. Depois
  // disso vídeo, chat e ofertas seguem o ponto individual. Desligada, o
  // webinar permanece sincronizado pela cronologia global da transmissão.
  const firstPosition = clampPosition(
    draftMode
      ? initialScheduledElapsed
      : previewMode
        ? 0
        : resumeProgressEnabled
          ? initialResumeSeconds
          : initialScheduledElapsed,
    durationSeconds
  );
  const playbackPositionRef = useRef(firstPosition);
  const desiredPositionRef = useRef(firstPosition);
  const persistedPositionRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(firstPosition);
  const [scheduledElapsed, setScheduledElapsed] = useState(initialScheduledElapsed);
  const [phaseState, setPhase] = useState<Phase>(() => {
    if (previewMode) return "live";
    if (draftMode) return phaseFor(initialScheduledElapsed, durationSeconds);
    if (!resumeProgressEnabled) return phaseFor(initialScheduledElapsed, durationSeconds);
    if (firstPosition >= durationSeconds && durationSeconds > 0) return "ended";
    // Não transforma um link nunca usado em replay após o encerramento global.
    if (initialScheduledElapsed >= durationSeconds && !hasStarted) return "ended";
    return initialScheduledElapsed < 0 ? "before" : "live";
  });
  // No preview forçamos "live" para o admin ver o player independente do horário.
  const phase: Phase = previewMode ? "live" : phaseState;
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  // Tela cheia nativa (Fullscreen API pedida no container) e, onde ela não
  // existe — iPhone —, a tela cheia por CSS. Nas duas o <video> continua sem
  // `controls`, então quem aparece é só a nossa barra.
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [cssFullscreen, setCssFullscreen] = useState(false);
  // A tela cheia por CSS só vale enquanto o player está no ar: no encerramento a
  // tela inteira troca e a rolagem da página precisa voltar.
  const overlayFullscreen = cssFullscreen && phase === "live";
  const isFullscreen = nativeFullscreen || overlayFullscreen;
  // A barra de volume/tela cheia fica escondida: aparece com o mouse sobre o
  // player ou no toque, e some sozinha depois de um tempo parado.
  const [controlsVisible, setControlsVisible] = useState(false);
  /** A reprodução parou e o próprio player não conseguiu retomar sozinho. */
  const [paused, setPaused] = useState(false);
  const hideControlsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Libera a única busca que o próprio player faz (posicionar a aula). */
  const allowSeekRef = useRef(false);

  /** `keep` segura a barra enquanto o ponteiro ou o foco está nela. */
  const revealControls = useCallback((keep = false) => {
    if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    hideControlsRef.current = null;
    setControlsVisible(true);
    if (!keep) {
      hideControlsRef.current = setTimeout(
        () => setControlsVisible(false),
        CONTROLS_IDLE_MS
      );
    }
  }, []);

  const hideControls = useCallback(() => {
    if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    hideControlsRef.current = null;
    setControlsVisible(false);
  }, []);

  useEffect(
    () => () => {
      if (hideControlsRef.current) clearTimeout(hideControlsRef.current);
    },
    []
  );

  /**
   * Modo relógio: a cronologia da turma (chat, oferta, encerramento) vem do
   * horário da sessão, não do vídeo de cada pessoa. É o padrão do produto.
   */
  const clockDriven = !previewMode && !draftMode && !resumeProgressEnabled;

  const progressStorageKey =
    previewMode || draftMode || !resumeProgressEnabled
      ? null
      : registrationToken
        ? `aw_watch_position:${registrationToken}`
        : webinarId
          ? `aw_watch_position:${webinarId}:${scheduledStartAtIso}`
          : null;

  /** Atualiza o ponto sem nunca retroceder por uma resposta antiga da rede. */
  const updatePlaybackPosition = useCallback(
    (position: number, persist = true) => {
      const next = clampPosition(
        Math.max(playbackPositionRef.current, position),
        durationSeconds
      );
      playbackPositionRef.current = next;
      desiredPositionRef.current = next;
      const storedPosition = Math.floor(next);
      // No modo relógio quem manda na linha do tempo é o horário da turma: se o
      // vídeo também escrevesse aqui, chat e oferta ficariam oscilando entre as
      // duas fontes a cada segundo enquanto houvesse atraso. O ponto do vídeo
      // segue alimentando a trava de busca e o heartbeat pelos refs acima.
      if (!clockDriven) {
        setElapsed((previous) =>
          Math.floor(previous) === storedPosition ? previous : next
        );
      }

      if (
        persist &&
        progressStorageKey &&
        persistedPositionRef.current !== storedPosition
      ) {
        try {
          localStorage.setItem(progressStorageKey, String(storedPosition));
          persistedPositionRef.current = storedPosition;
        } catch {
          // O player continua funcionando mesmo em navegação privada/storage bloqueado.
        }
      }

      if (durationSeconds > 0 && next >= durationSeconds) setPhase("ended");
      return next;
    },
    [clockDriven, durationSeconds, progressStorageKey]
  );

  /**
   * Traz o vídeo de volta para o ponto da turma no modo relógio.
   *
   * No celular a reprodução é interrompida o tempo todo — tela bloqueada,
   * ligação, troca de app, rebuffer no 4G — e cada interrupção deixava o vídeo
   * atrasado PARA SEMPRE, enquanto chat, oferta e encerramento seguiam o
   * relógio. A pessoa via a oferta antes da fala e era mandada para a tela de
   * encerrado ainda no meio da aula, sem nunca chegar no fechamento.
   *
   * Só adianta: nunca volta atrás, que é a regra do simulated live.
   */
  const syncToLiveClock = useCallback(() => {
    const video = videoRef.current;
    if (!video || !clockDriven || video.readyState < 1) return;
    const target = clampPosition(elapsedSeconds(scheduledStartAtIso), durationSeconds);
    // A aula já acabou no relógio: quem encerra é a fase, não um salto para o fim.
    if (durationSeconds > 0 && target >= durationSeconds) return;
    if (target - video.currentTime <= DRIFT_TOLERANCE_SECONDS) return;
    // A trava de busca desfaria a correção: esta é uma busca do próprio player.
    allowSeekRef.current = true;
    video.currentTime = target;
  }, [clockDriven, durationSeconds, scheduledStartAtIso]);

  function setPlayerVolume(nextVolume: number) {
    const next = Math.min(1, Math.max(0, nextVolume));
    const video = videoRef.current;
    setVolume(next);
    setMuted(next === 0);
    if (video) {
      video.volume = next;
      video.muted = next === 0;
      if (next > 0) video.play().catch(() => {});
    }
  }

  function toggleMuted() {
    const video = videoRef.current;
    const nextMuted = !muted;
    const nextVolume = nextMuted ? volume : volume || 0.7;
    setMuted(nextMuted);
    setVolume(nextVolume);
    if (video) {
      video.muted = nextMuted;
      video.volume = nextVolume;
      if (!nextMuted) video.play().catch(() => {});
    }
  }

  /** Tela cheia nativa deste player — só conta quando o elemento em tela cheia
   *  é o nosso container (o vídeo sozinho significaria player nativo). */
  const isNativeFullscreen = useCallback(() => {
    const webkitDocument = document as WebkitFullscreenDocument;
    const target = document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
    return Boolean(playerRef.current) && target === playerRef.current;
  }, []);

  async function toggleFullscreen() {
    const player = playerRef.current as WebkitFullscreenElement | null;
    if (!player) return;
    const webkitDocument = document as WebkitFullscreenDocument;

    if (isNativeFullscreen()) {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (webkitDocument.webkitFullscreenElement && webkitDocument.webkitExitFullscreen) {
        await webkitDocument.webkitExitFullscreen();
      }
      return;
    }

    if (cssFullscreen) {
      setCssFullscreen(false);
      return;
    }

    // A tela cheia é SEMPRE pedida no container, nunca no <video>: assim o vídeo
    // segue sem `controls` e a barra em tela é a nossa (volume + sair).
    try {
      if (typeof player.requestFullscreen === "function") {
        await player.requestFullscreen();
        return;
      }
      if (typeof player.webkitRequestFullscreen === "function") {
        await player.webkitRequestFullscreen();
        return;
      }
    } catch {
      // Safari pode rejeitar o container — segue para a tela cheia por CSS.
    }

    // iPhone: não há Fullscreen API para elementos comuns e o único recurso
    // nativo abriria o player do iOS com controles de pausa e busca. Ocupamos a
    // viewport por CSS, mantendo a aula sem nenhum controle de reprodução.
    setCssFullscreen(true);
  }

  useEffect(() => {
    const syncFullscreen = () => {
      const active = isNativeFullscreen();
      setNativeFullscreen(active);
      if (active) setCssFullscreen(false);
      // Entrar ou sair (inclusive pelo Esc) remonta o player: mostra a barra
      // uma vez para o botão de sair não ficar escondido.
      revealControls();
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, [isNativeFullscreen, revealControls]);

  // Tela cheia por CSS: trava a rolagem da página e devolve o Esc como saída.
  useEffect(() => {
    if (!overlayFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCssFullscreen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [overlayFullscreen]);

  // Uma mudança de sessão (recorrência/JIT) sempre começa um progresso novo.
  useEffect(() => {
    const position = clampPosition(
      draftMode
        ? elapsedSeconds(scheduledStartAtIso)
        : previewMode
          ? 0
          : resumeProgressEnabled
            ? initialResumeSeconds
            : elapsedSeconds(scheduledStartAtIso),
      durationSeconds
    );
    playbackPositionRef.current = position;
    desiredPositionRef.current = position;
    persistedPositionRef.current = null;
    setElapsed(position);
    setScheduledElapsed(elapsedSeconds(scheduledStartAtIso));
    if (previewMode) setPhase("live");
    else if (draftMode) setPhase(phaseFor(elapsedSeconds(scheduledStartAtIso), durationSeconds));
    else if (!resumeProgressEnabled) setPhase(phaseFor(elapsedSeconds(scheduledStartAtIso), durationSeconds));
    else if (durationSeconds > 0 && position >= durationSeconds) setPhase("ended");
    else if (elapsedSeconds(scheduledStartAtIso) >= durationSeconds && !hasStarted) {
      setPhase("ended");
    } else {
      setPhase(elapsedSeconds(scheduledStartAtIso) < 0 ? "before" : "live");
    }
  }, [
    durationSeconds,
    draftMode,
    hasStarted,
    initialResumeSeconds,
    previewMode,
    registrationToken,
    resumeProgressEnabled,
    scheduledStartAtIso,
  ]);

  // Recupera primeiro a cópia local (últimos segundos) e depois confirma o
  // maior ponto salvo no servidor, permitindo continuar até em outro aparelho.
  useEffect(() => {
    if (!progressStorageKey) return;
    try {
      const saved = Number(localStorage.getItem(progressStorageKey));
      if (Number.isFinite(saved)) {
        const next = updatePlaybackPosition(saved, false);
        if (next > 0 && next < durationSeconds) setPhase("live");
      }
    } catch {
      // Storage indisponível: o ponto remoto continua sendo usado para inscritos.
    }
  }, [durationSeconds, progressStorageKey, updatePlaybackPosition]);

  useEffect(() => {
    if (!registrationToken || previewMode || draftMode || !resumeProgressEnabled) return;
    let cancelled = false;
    getRecordedPlaybackPosition(registrationToken)
      .then((position) => {
        if (cancelled) return;
        const next = updatePlaybackPosition(position, false);
        if (next > 0 && next < durationSeconds) setPhase("live");
        const video = videoRef.current;
        if (video && video.readyState >= 1 && next > video.currentTime + 1) {
          allowSeekRef.current = true;
          video.currentTime = next;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    draftMode,
    durationSeconds,
    previewMode,
    registrationToken,
    resumeProgressEnabled,
    updatePlaybackPosition,
  ]);

  // Relógio mestre: sem continuidade ele define toda a cronologia. Com ela
  // ligada, só mantém a contagem regressiva antes da entrada na sala.
  useEffect(() => {
    if (previewMode) return;
    const tick = () => {
      const e = elapsedSeconds(scheduledStartAtIso);
      setScheduledElapsed(e);
      if (draftMode || !resumeProgressEnabled) {
        setElapsed(clampPosition(e, durationSeconds));
        setPhase(phaseFor(e, durationSeconds));
        return;
      }
      setPhase((current) => {
        if (current === "ended") return current;
        return e < 0 ? "before" : "live";
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [draftMode, durationSeconds, previewMode, resumeProgressEnabled, scheduledStartAtIso]);

  // Heartbeat de presença (métricas reais no admin). Não conta no preview.
  // Inscrito → por token; anônimo (link público) → por id de navegador.
  //
  // Só bate ponto quem está DE FATO na aula: a contagem regressiva, um vídeo
  // pausado ou a tela de encerramento não contam — senão uma aba esquecida
  // aberta viraria play, "até o fim" e "assistindo agora" pra sempre.
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
      const video = videoRef.current;
      if (phase !== "live" || !video || video.paused || video.ended) return;
      const currentPosition = Math.floor(playbackPositionRef.current);
      const pos = durationSeconds > 0 ? Math.min(currentPosition, durationSeconds) : currentPosition;
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
    phase,
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
            // No celular o player tem ~390px de largura: sem teto, o ABR sobe
            // para 1080p+, queima o pacote de dados do lead e trava no 4G — e
            // cada travada vira atraso na aula.
            capLevelToPlayerSize: true,
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

  // Posiciona uma única vez no ponto individual já salvo. Não há drift de
  // relógio: se a pessoa sair, o vídeo fica exatamente onde ela parou.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase !== "live") return;
    // Preview: sem trava de relógio — o admin controla seek/velocidade à vontade.
    if (previewMode) {
      if (video.paused) video.play().catch(() => {});
      return;
    }

    let positioned = false;
    const resume = () => {
      if (positioned) return;
      const position = clampPosition(desiredPositionRef.current, durationSeconds);
      if (durationSeconds > 0 && position >= durationSeconds) {
        setPhase("ended");
        return;
      }
      if (!positioned) {
        allowSeekRef.current = true;
        video.currentTime = position;
        positioned = true;
      }
      if (video.paused) video.play().catch(() => {});
    };
    video.addEventListener("canplay", resume);

    // Sem controles o visitante não busca/põe em pausa. Mantemos a proteção
    // contra atalhos que possam pausar o elemento nativo.
    //
    // Quando a retomada é REJEITADA — no iPhone isso acontece depois de uma
    // ligação, de outra interrupção da sessão de áudio ou no Modo de Baixo
    // Consumo — o vídeo ficava congelado sem nenhum botão na tela, e a única
    // saída era recarregar a página. Aí marcamos `paused` e oferecemos o toque.
    const onPause = () => {
      if (phase !== "live" || video.ended) return;
      video.play().then(
        () => setPaused(false),
        () => setPaused(true)
      );
    };
    const onPlaying = () => setPaused(false);
    video.addEventListener("pause", onPause);
    video.addEventListener("playing", onPlaying);

    // Nem avança nem volta: uma aula ao vivo não tem barra de progresso. Vale
    // para toda origem de busca que não passa pela página — teclas de mídia,
    // painel de mídia do navegador/sistema, extensão.
    const onSeeking = () => {
      if (allowSeekRef.current) {
        allowSeekRef.current = false;
        return;
      }
      const target = clampPosition(playbackPositionRef.current, durationSeconds);
      if (Math.abs(video.currentTime - target) > SEEK_TOLERANCE_SECONDS) {
        video.currentTime = target;
      }
    };
    video.addEventListener("seeking", onSeeking);

    if (video.readyState >= 3) resume();

    return () => {
      video.removeEventListener("canplay", resume);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("seeking", onSeeking);
    };
  }, [durationSeconds, phase, previewMode]);

  // Modo relógio: mantém o vídeo junto da turma. Além do tique de 1s, corrige
  // no instante em que a pessoa volta para a aba e a cada retomada da
  // reprodução — que é quando o atraso do celular aparece.
  useEffect(() => {
    if (!clockDriven || phase !== "live") return;
    const video = videoRef.current;
    if (!video) return;
    syncToLiveClock();
    const id = setInterval(syncToLiveClock, 1000);
    const onVisibility = () => {
      if (!document.hidden) syncToLiveClock();
    };
    document.addEventListener("visibilitychange", onVisibility);
    video.addEventListener("playing", syncToLiveClock);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      video.removeEventListener("playing", syncToLiveClock);
    };
  }, [clockDriven, phase, syncToLiveClock]);

  // O painel de mídia do sistema (teclas de mídia, central do navegador) traz
  // avançar/voltar próprios. Handlers vazios tiram a ação antes de ela virar
  // uma busca — a trava do `seeking` acima é a rede de segurança.
  useEffect(() => {
    if (previewMode || phase !== "live") return;
    const session = navigator.mediaSession;
    if (!session) return;
    const blocked: MediaSessionAction[] = [
      "seekbackward",
      "seekforward",
      "seekto",
      "previoustrack",
      "nexttrack",
    ];
    for (const action of blocked) {
      try {
        session.setActionHandler(action, () => {});
      } catch {
        // Ação não suportada neste navegador — nada a bloquear.
      }
    }
    return () => {
      for (const action of blocked) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // Idem: se não dá para registrar, também não dá para limpar.
        }
      }
    };
  }, [phase, previewMode]);

  void accentColor; // cores vêm do tema do player (vermelho/branco)
  const brand = brandName || presenterName || title;
  const shownTitle = displayTitle(title);

  const shell = (content: React.ReactNode, live?: boolean) => (
    <HwPage logoUrl={logoUrl} brandName={brand} presenterName={presenterName} live={live}>
      {content}
    </HwPage>
  );

  // A inscrição continua indo para a sala/contagem antes da aula. Somente no
  // encerramento levamos a pessoa para a página final daquele webinar. Previews
  // continuam nesta tela para o painel conseguir revisar o estado encerrado.
  useEffect(() => {
    if (phase !== "ended" || !thankYouPath || previewMode || draftMode) return;
    const access = registrationToken ? `?acesso=${encodeURIComponent(registrationToken)}` : "";
    window.location.replace(`${thankYouPath}${access}`);
  }, [draftMode, phase, previewMode, registrationToken, thankYouPath]);

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
      Date.now()
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
      support={<SupportBox whatsapp={supportWhatsapp} />}
    />
  );
  if (phase === "ended" && !previewMode) return endedScreen;

  // ---------- FASE: ANTES (contagem regressiva) ----------
  if (phase === "before") {
    return shell(
      <HwCountdownScreen
        title={shownTitle}
        ms={Math.max(0, -scheduledElapsed) * 1000}
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

  return shell(
    <div className="mx-auto grid max-w-[1400px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* ---- Coluna do player ---- */}
      <div className="space-y-4">
        <div
          ref={playerRef}
          /* `relative` só fora da tela cheia por CSS: as duas classes de
             posicionamento brigariam e a ordem do Tailwind venceria a do JSX.
             O tamanho vai explícito (h/w-dvh) porque a margem do `space-y-4`
             encolheria uma caixa fixa de altura automática. */
          className={`overflow-hidden bg-black ${
            overlayFullscreen
              ? "fixed inset-0 z-50 h-dvh w-dvw rounded-none"
              : nativeFullscreen
                ? "relative h-dvh w-dvw rounded-none"
                : "relative aspect-video rounded-2xl"
          }`}
          /* Mouse: a barra segue o ponteiro sobre o player. Toque: um toque
             na área do vídeo mostra, outro esconde. */
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") revealControls();
          }}
          onPointerMove={(event) => {
            if (event.pointerType === "mouse") revealControls();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") hideControls();
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") return;
            if (controlsVisible) hideControls();
            else revealControls();
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted={previewMode ? false : muted}
            playsInline
            controls={previewMode}
            controlsList={previewMode ? "nodownload" : "nodownload noplaybackrate"}
            /* PiP fora do preview: a janelinha do sistema traz pausa e barra de
               progresso próprias — a mesma brecha da tela cheia nativa. */
            disablePictureInPicture={!previewMode}
            onContextMenu={(e) => e.preventDefault()}
            className={`h-full w-full object-contain ${previewMode ? "" : "pointer-events-none"}`}
            onTimeUpdate={(event) => updatePlaybackPosition(event.currentTarget.currentTime)}
            onEnded={() => {
              updatePlaybackPosition(durationSeconds);
              setPhase("ended");
            }}
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
                setPlayerVolume(volume || 0.7);
              }}
              className="absolute inset-0 z-10 grid cursor-pointer place-items-center bg-black/40 backdrop-blur-[1px]"
              aria-label="Ativar som"
            >
              <span className="flex animate-pulse items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[16px] font-bold text-[#0f0f0f] shadow-2xl">
                🔊 Clique para ouvir o áudio
              </span>
            </button>
          )}

          {/* Reprodução travada: o overlay de áudio já cobre o caso do vídeo
              mudo, então este só aparece para quem já liberou o som. Ao voltar,
              a aula pega o ponto da turma — não o ponto onde travou. */}
          {videoUrl && !connecting && !previewMode && paused && !muted && (
            <button
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.play().then(() => {
                  setPaused(false);
                  syncToLiveClock();
                }, () => {});
              }}
              className="absolute inset-0 z-10 grid cursor-pointer place-items-center bg-black/50 backdrop-blur-[1px]"
              aria-label="Continuar assistindo"
            >
              <span className="flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[16px] font-bold text-[#0f0f0f] shadow-2xl">
                ▶ Toque para continuar
              </span>
            </button>
          )}

          {videoUrl && !previewMode && (
            <div
              className={`absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/65 p-1.5 text-white shadow-lg backdrop-blur-md transition-opacity duration-200 ${
                controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              /* Na tela cheia por CSS (iPhone) a barra sobe acima do indicador
                 de home — senão o botão de sair fica fora do alcance. */
              style={
                overlayFullscreen
                  ? { bottom: "max(0.75rem, env(safe-area-inset-bottom))" }
                  : undefined
              }
              role="group"
              aria-label="Controles do vídeo"
              /* Enquanto se mexe na barra ela fica; o toque aqui não pode
                 chegar no container, senão o próprio uso a esconderia. */
              onPointerDown={(event) => {
                event.stopPropagation();
                revealControls(true);
              }}
              /* Sem o stopPropagation o movimento dentro da barra chegaria ao
                 container e rearmaria a contagem para escondê-la. */
              onPointerMove={(event) => {
                event.stopPropagation();
                revealControls(true);
              }}
              onPointerUp={() => revealControls()}
              onPointerEnter={() => revealControls(true)}
              onPointerLeave={() => revealControls()}
              onFocus={() => revealControls(true)}
              onBlur={() => revealControls()}
            >
              <button
                type="button"
                onClick={toggleMuted}
                className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label={muted || volume === 0 ? "Ativar som" : "Silenciar"}
              >
                {muted || volume === 0 ? (
                  <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current">
                    <path d="M4 9v6h4l5 4V5L8 9H4Zm12.7 3 2.15-2.15-1.41-1.41L15.29 10.6 13.14 8.44l-1.41 1.41L13.88 12l-2.15 2.15 1.41 1.41 2.15-2.15 2.15 2.15 1.41-1.41L16.7 12Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current">
                    <path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a3.5 3.5 0 0 0-2-3.15v6.3a3.5 3.5 0 0 0 2-3.15Zm0-7.75v2.1a5.5 5.5 0 0 1 0 11.3v2.1a7.5 7.5 0 0 0 0-15.5Z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(event) => setPlayerVolume(Number(event.target.value))}
                className="h-1.5 w-20 cursor-pointer accent-[var(--hw-red)]"
                aria-label="Volume"
              />
              {fullscreen && (
                <button
                  type="button"
                  onClick={() => toggleFullscreen().catch(() => {})}
                  className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                >
                  {isFullscreen ? (
                    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M9 4v5H4m11-5v5h5M9 20v-5H4m16 5v-5h-5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M9 4H4v5m16 0V4h-5M4 15v5h5m6 0h5v-5" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}

        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold leading-snug tracking-tight sm:text-[22px]">
              {shownTitle}
            </h1>
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
