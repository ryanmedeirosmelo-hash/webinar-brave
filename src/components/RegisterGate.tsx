"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LivePlayer } from "./LivePlayer";
import { displayTitle } from "./Brand";
import {
  HwAvatar,
  HwChip,
  HwCountdownScreen,
  HwEndedScreen,
  HwLiveBadge,
  HwPage,
  hwButton,
  hwInput,
} from "./HwKit";
import { registerForSession } from "@/app/actions/registrations";
import { getRecordedPlaybackPosition } from "@/app/actions/heartbeat";
import { SupportBox } from "./SupportBox";
import { TimedOffer } from "./TimedOffer";
import {
  nextSessionStart,
  zonedParts,
  lastEndedSessionToday,
  postLiveOfferOpen,
  POST_LIVE_OFFER_UNTIL,
  REGISTRATION_LEAD_MS,
} from "@/lib/time";
import type { Webinar, ChatMessage, Offer, SalesNotification } from "@/types/db";
import { FREE_ENTRY_DATES, FREE_ENTRY_SLUGS, PRE_COUNTDOWN_SLUGS } from "@/lib/brand";
import { supportWhatsAppNumber } from "@/lib/whatsapp";

type SavedPerson = { name: string; email: string; phone: string };
type SavedSession = { iso: string; token: string };

type DraftView = "cadastro" | "contagem" | "aovivo" | "encerrada";

type Props = {
  draftView?: DraftView;
  webinar: Webinar;
  videoUrl: string;
  messages: ChatMessage[];
  offers: Offer[];
  sales: SalesNotification[];
};

let clockNow = 0;

function subscribeToClock(onStoreChange: () => void) {
  const tick = () => {
    clockNow = Date.now();
    onStoreChange();
  };

  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}

function getClockSnapshot() {
  return clockNow;
}

function getServerClockSnapshot() {
  return 0;
}

function subscribeToHydration() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

function readSavedValue<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

/** Progresso que o player gravou neste navegador para a inscrição atual. */
function savedPlaybackPosition(token: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(localStorage.getItem(`aw_watch_position:${token}`));
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

function browserLeadSource() {
  return {
    origin: window.location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
  };
}

function fmtWhen(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(ms));
}

export function RegisterGate({ webinar, videoUrl, messages, offers, sales, draftView }: Props) {
  // Evita mismatch de hidratação: só calcula horários após montar no cliente.
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerHydrationSnapshot
  );
  const now = useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);

  const cacheKey = `aw_reg:${webinar.id}`;
  const sessionKey = `aw_reg_session:${webinar.id}`;
  const [person, setPerson] = useState<SavedPerson | null>(() =>
    draftView ? null : readSavedValue<SavedPerson>(cacheKey)
  );
  const [session, setSession] = useState<SavedSession | null>(() =>
    draftView ? null : readSavedValue<SavedSession>(sessionKey)
  );
  const [hasRecordedProgress, setHasRecordedProgress] = useState(() =>
    !draftView && !!session && savedPlaybackPosition(session.token) > 0
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tz = webinar.timezone;
  const supportWhatsapp = supportWhatsAppNumber(webinar.integrations);

  // O navegador responde de imediato. Em outro aparelho, confirmamos o ponto
  // remoto antes de liberar a continuidade após o encerramento da turma.
  useEffect(() => {
    if (draftView || !webinar.resume_progress_enabled || !session) {
      setHasRecordedProgress(false);
      return;
    }

    const localPosition = savedPlaybackPosition(session.token);
    setHasRecordedProgress(localPosition > 0);
    let cancelled = false;
    getRecordedPlaybackPosition(session.token)
      .then((position) => {
        if (!cancelled && position > 0) setHasRecordedProgress(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [draftView, session?.token, webinar.resume_progress_enabled]);

  // Próxima sessão recalculada a cada tique (rola sozinha quando a aula acaba).
  const startMs = mounted ? nextSessionStart(webinar, now).getTime() : 0;
  const startIso = startMs ? new Date(startMs).toISOString() : "";
  // A próxima sessão é HOJE? Só nesse caso mostramos timer/sala; fora do dia do
  // evento (e depois que a aula de hoje acaba) fica a tela "encerrada", até
  // 00:00 do próximo dia de evento — quando a sessão volta a ser "hoje".
  const sessionIsToday =
    draftView ? true :
    mounted && zonedParts(startMs, tz).date === zonedParts(now, tz).date;
  const windowOpen = draftView ? draftView === "cadastro" : mounted && now >= startMs - REGISTRATION_LEAD_MS;
  const freeEntry =
    !draftView && mounted &&
    (FREE_ENTRY_SLUGS.has(webinar.slug) || FREE_ENTRY_DATES.has(zonedParts(now, tz).date));

  // Assim que a aula de hoje acaba, `nextSessionStart` pula pra próxima semana e
  // esta tela vira "encerrada" — é AQUI que a espectadora cai no segundo em que
  // a sala fecha. A oferta da live que acabou continua na tela até as 22:00.
  const endedToday = mounted ? lastEndedSessionToday(webinar, now) : null;
  const offerAfterEnd = !!endedToday && postLiveOfferOpen(endedToday.getTime(), tz, now);
  // Quando o webinar libera continuidade, quem entrou na turma e já acumulou
  // progresso pode voltar mesmo depois do fim do horário global. Quem nunca
  // abriu a aula continua vendo a próxima turma, sem transformar o link em replay.
  const resumeEndedSession =
    !draftView &&
    webinar.resume_progress_enabled &&
    !!endedToday &&
    !!session &&
    session.iso === endedToday.toISOString() &&
    (hasRecordedProgress || savedPlaybackPosition(session.token) > 0);

  // Cadastrado (cache): garante uma inscrição pra sessão de hoje quando a janela
  // abre — assim a presença/identidade é registrada toda semana sem repreencher.
  useEffect(() => {
    if (!mounted || !person || !sessionIsToday || !windowOpen || !startIso) return;
    if (session && session.iso === startIso) return; // já temos token desta sessão
    const { date, time } = zonedParts(startMs, tz);
    let cancelled = false;
    registerForSession({
      webinarId: webinar.id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      date,
      time,
      ...browserLeadSource(),
    })
      .then((r) => {
        if (cancelled || !r.ok) return;
        const s = { iso: r.scheduledStartAtIso, token: r.token };
        setSession(s);
        try {
          localStorage.setItem(sessionKey, JSON.stringify(s));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, person, sessionIsToday, windowOpen, startIso]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    if (name.length < 2) return setError("Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("E-mail inválido.");
    if (phone.replace(/\D/g, "").length < 8) return setError("Informe um telefone válido com DDD.");

    setPending(true);
    const { date, time } = zonedParts(startMs, tz);
    const r = await registerForSession({
      webinarId: webinar.id,
      name,
      email,
      phone,
      date,
      time,
      ...browserLeadSource(),
    });
    setPending(false);
    if (!r.ok) return setError(r.error);

    const p = { name, email, phone };
    const s = { iso: r.scheduledStartAtIso, token: r.token };
    setPerson(p);
    setSession(s);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(p));
      localStorage.setItem(sessionKey, JSON.stringify(s));
    } catch {
      /* ignore */
    }

  }

  const brandName = webinar.presenter_name || displayTitle(webinar.title);
  const title = displayTitle(webinar.title);

  const shell = (content: React.ReactNode) => (
    <HwPage
      logoUrl={webinar.logo_url}
      brandName={brandName}
      presenterName={webinar.presenter_name}
    >
      {content}
    </HwPage>
  );

  // ---- Enquanto não montou: placeholder neutro (sem horário) ----
  if (!mounted) {
    return shell(
      <p className="px-5 py-24 text-center text-[15px] text-[var(--hw-muted)]">Carregando…</p>
    );
  }

  if (resumeEndedSession && session) {
    return (
      <LivePlayer
        title={webinar.title}
        presenterName={webinar.presenter_name}
        presenterAvatarUrl={webinar.presenter_avatar_url}
        brandName={brandName}
        logoUrl={webinar.logo_url}
        webinarId={webinar.id}
        registrationToken={session.token}
        initialResumeSeconds={savedPlaybackPosition(session.token)}
        hasStarted
        resumeProgressEnabled={webinar.resume_progress_enabled}
        viewerName={person?.name ?? null}
        supportWhatsapp={supportWhatsapp}
        thankYouPath={`/obrigado/${webinar.slug}`}
        videoUrl={videoUrl}
        durationSeconds={webinar.duration_seconds}
        scheduledStartAtIso={session.iso}
        timezone={tz}
        messages={messages}
        offers={offers}
        sales={sales}
        salesTitle={webinar.sales_notification_title}
        autoplay={webinar.video_autoplay}
        fullscreen={webinar.video_fullscreen}
        audience={{
          enabled: webinar.audience_enabled,
          mode: webinar.audience_mode,
          min: webinar.audience_min,
          max: webinar.audience_max,
        }}
      />
    );
  }

  // ---- Fora do dia do evento (ou aula de hoje já acabou) → "encerrada" ----
  // Fica assim até 00:00 do próximo dia de evento, quando a sessão vira "hoje".
  // Exceção: aula avulsa divulgada com antecedência (PRE_COUNTDOWN_SLUGS) segue
  // adiante e cai na contagem regressiva — mas só enquanto NADA encerrou hoje.
  const preCountdown = !draftView && PRE_COUNTDOWN_SLUGS.has(webinar.slug) && !endedToday;
  if (!sessionIsToday && !preCountdown) {
    return shell(
      <HwEndedScreen
        title={title}
        note="Fique de olho no seu e-mail — avisamos assim que a próxima turma abrir."
        offerNote={`A condição apresentada na aula fica liberada até as ${POST_LIVE_OFFER_UNTIL} de hoje.`}
        offer={
          offerAfterEnd && endedToday ? (
            <TimedOffer
              offers={offers}
              elapsed={webinar.duration_seconds - 1}
              webinarId={webinar.id}
              registrationToken={
                session?.iso === endedToday.toISOString() ? session.token : null
              }
              sessionStartIso={endedToday.toISOString()}
              stacked
            />
          ) : null
        }
        support={<SupportBox whatsapp={supportWhatsapp} />}
      />
    );
  }

  const token = session && session.iso === startIso ? session.token : null;

  if (draftView === "aovivo" || draftView === "encerrada") {
    // Revisão local: no "ao vivo" adianta o relógio até a hora da oferta (quando
    // ela cabe na aula), pra conferir o card com o link real de checkout.
    const primeiraOferta = offers.find((o) => !o.disabled);
    const segsAoVivo =
      primeiraOferta && primeiraOferta.show_at_seconds + 5 < webinar.duration_seconds
        ? primeiraOferta.show_at_seconds + 5
        : 30;
    const draftStart = new Date(
      now - (draftView === "aovivo" ? segsAoVivo : webinar.duration_seconds + 5) * 1000
    ).toISOString();
    return (
      <LivePlayer
        title={webinar.title}
        presenterName={webinar.presenter_name}
        presenterAvatarUrl={webinar.presenter_avatar_url}
        brandName={brandName}
        logoUrl={webinar.logo_url}
        webinarId={webinar.id}
        videoUrl={videoUrl}
        durationSeconds={webinar.duration_seconds}
        scheduledStartAtIso={draftStart}
        timezone={tz}
        messages={messages}
        offers={offers}
        sales={sales}
        salesTitle={webinar.sales_notification_title}
        autoplay={webinar.video_autoplay}
        fullscreen={webinar.video_fullscreen}
        draftMode
        resumeProgressEnabled={webinar.resume_progress_enabled}
        supportWhatsapp={supportWhatsapp}
        thankYouPath={`/obrigado/${webinar.slug}`}
        audience={{ enabled: webinar.audience_enabled, mode: webinar.audience_mode, min: webinar.audience_min, max: webinar.audience_max }}
      />
    );
  }

  // ---- Dia do evento + cadastrado (ou ENTRADA LIVRE) → vai direto pra sala ----
  if (!draftView && (person || freeEntry)) {
    return (
      <LivePlayer
        title={webinar.title}
        presenterName={webinar.presenter_name}
        presenterAvatarUrl={webinar.presenter_avatar_url}
        brandName={brandName}
        logoUrl={webinar.logo_url}
        webinarId={webinar.id}
        registrationToken={token}
        resumeProgressEnabled={webinar.resume_progress_enabled}
        viewerName={person?.name ?? null}
        supportWhatsapp={supportWhatsapp}
        thankYouPath={`/obrigado/${webinar.slug}`}
        videoUrl={videoUrl}
        durationSeconds={webinar.duration_seconds}
        scheduledStartAtIso={startIso}
        timezone={tz}
        messages={messages}
        offers={offers}
        sales={sales}
        salesTitle={webinar.sales_notification_title}
        autoplay={webinar.video_autoplay}
        fullscreen={webinar.video_fullscreen}
        audience={{
          enabled: webinar.audience_enabled,
          mode: webinar.audience_mode,
          min: webinar.audience_min,
          max: webinar.audience_max,
        }}
      />
    );
  }

  // ---- Dia do evento + não cadastrado + janela fechada → timer da aula ----
  if (!windowOpen) {
    return shell(
      <HwCountdownScreen
        title={title}
        ms={startMs - now}
        presenterName={webinar.presenter_name}
        presenterAvatarUrl={webinar.presenter_avatar_url}
      />
    );
  }

  // ---- Dia do evento + janela aberta → formulário (nome/email/telefone) ----
  return shell(
    <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-16">
      {/* ---- Hero ---- */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <HwLiveBadge label="Aula ao vivo" />
          <HwChip>Gratuita</HwChip>
          <HwChip>Vagas limitadas</HwChip>
        </div>

        <h1 className="text-[34px] font-bold leading-[1.15] tracking-tight sm:text-[44px] lg:text-[52px]">
          {title}
        </h1>

        {webinar.description && (
          <p className="max-w-xl text-[17px] leading-relaxed text-[var(--hw-muted)]">
            {webinar.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <div className="flex items-center gap-3">
            <HwAvatar
              name={brandName}
              size={44}
              presenterName={webinar.presenter_name}
              presenterAvatarUrl={webinar.presenter_avatar_url}
            />
            <div className="leading-tight">
              <p className="text-[15px] font-semibold">{brandName}</p>
              <p className="text-[13px] text-[var(--hw-muted)]">Quem apresenta</p>
            </div>
          </div>
          <span className="hidden h-9 w-px bg-[var(--hw-border)] sm:block" />
          <div className="flex items-center gap-2 rounded-xl bg-[var(--hw-chip)] px-3.5 py-2 text-[14px] font-medium">
            <span aria-hidden>🗓️</span>
            <span className="capitalize">Hoje, {fmtWhen(startMs, tz)}</span>
          </div>
        </div>

        <ul className="grid gap-2.5 pt-2 text-[15px] text-[var(--hw-muted)]">
          {[
            "Transmissão ao vivo, sem gravação depois",
            "Condição especial liberada só durante a aula",
            "Chat aberto para tirar dúvidas",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--hw-red)] text-[11px] font-bold text-white">
                ✓
              </span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Formulário ---- */}
      <section>
        <div
          className="rounded-2xl border border-[var(--hw-border)] bg-[var(--hw-surface)] p-6 sm:p-8"
          style={{ boxShadow: "var(--hw-shadow)" }}
        >
          <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--hw-red)]">
            Inscrição gratuita
          </p>
          <h2 className="mt-1.5 text-[26px] font-bold tracking-tight">Garanta sua vaga</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--hw-muted)]">
            Preencha para entrar na aula. Você cai direto na sala — não precisa preencher de
            novo neste aparelho.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-[14px] font-medium">Nome</label>
              <input
                name="name"
                required
                autoComplete="name"
                placeholder="Seu nome"
                className={hwInput}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[14px] font-medium">E-mail</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="voce@email.com"
                className={hwInput}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[14px] font-medium">Telefone (WhatsApp)</label>
              <input
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                className={hwInput}
              />
            </div>

            {error && (
              <p className="rounded-xl border border-[var(--hw-red)]/30 bg-[var(--hw-red)]/10 px-3 py-2 text-[14px] text-[var(--hw-red)]">
                {error}
              </p>
            )}

            <button type="submit" disabled={pending} className={`${hwButton} w-full py-3.5 text-[16px]`}>
              {pending ? "Confirmando..." : `${webinar.capture_button_label || "Entrar na aula"} →`}
            </button>

            <p className="text-center text-[12px] text-[var(--hw-muted)]">
              🔒 Seus dados são usados só para o acesso à aula.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
