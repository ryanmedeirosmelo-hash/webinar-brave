"use client";

import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import { createRegistration, type RegistrationState } from "@/app/actions/registrations";
import { jitSlots, recurrenceSlots, zonedParts, type JitSlot } from "@/lib/time";
import type { FormField, WebinarType } from "@/types/db";

type Props = {
  webinarId: string;
  availableTimes: string[];
  timezone: string;
  type: WebinarType;
  jitIntervalMinutes: number;
  durationSeconds: number;
  recurrenceEnabled: boolean;
  recurrenceFreq: string;
  recurrenceDays: number[];
  /** Campos ligados/rotulados na etapa Login do painel. */
  formFields: FormField[];
  buttonLabel: string;
  buttonColor: string;
  buttonTextColor: string;
};

/** Rótulos e placeholders padrão quando a etapa Login não definiu um. */
const FIELD_DEFAULTS: Record<FormField["key"], { label: string; placeholder: string }> = {
  name: { label: "Nome completo", placeholder: "Seu nome completo" },
  email: { label: "E-mail", placeholder: "Seu melhor e-mail" },
  whatsapp: { label: "WhatsApp", placeholder: "Seu telefone" },
};

const COUNTRIES = [
  { code: "+55", flag: "🇧🇷" },
  { code: "+351", flag: "🇵🇹" },
  { code: "+1", flag: "🇺🇸" },
  { code: "+34", flag: "🇪🇸" },
  { code: "+44", flag: "🇬🇧" },
  { code: "+61", flag: "🇦🇺" },
];

const capLabel = "mb-2 block text-[15px] font-bold text-[color:var(--cap-ink)]";
/** Sem largura: quem usa decide (o seletor de DDI é estreito, o resto ocupa tudo). */
const capFieldBase =
  "rounded-[10px] border-[1.5px] border-[color:var(--cap-line)] bg-white px-4 py-[15px] text-[16px] text-[color:var(--cap-ink)] placeholder:text-[color:var(--cap-placeholder)] outline-none transition focus:border-[color:var(--cap-ink)]";
const capInput = `w-full ${capFieldBase}`;

/** "13:30" → "13h30" (formato do print). */
function hourLabel(time: string): string {
  return time.replace(":", "h");
}

/** "Hoje às 13h30" quando é o mesmo dia no fuso; senão "qui., 19/06 às 19h15". */
function slotWhen(slot: JitSlot, timezone: string, nowMs: number): string {
  if (slot.date === zonedParts(nowMs, timezone).date) {
    return `Hoje às ${hourLabel(slot.time)}`;
  }
  const when = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
  }).format(new Date(slot.startMs));
  return `${when} às ${hourLabel(slot.time)}`;
}

/**
 * Linha de urgência sob o horário. Recalculada do relógio a cada segundo (e não
 * do `offsetSeconds` congelado na montagem), pra "COMEÇA EM 3 MINUTOS" andar
 * sozinho enquanto a pessoa preenche o formulário.
 */
function slotStatus(slot: JitSlot, nowMs: number): { text: string; live: boolean } {
  const seconds = (slot.startMs - nowMs) / 1000;
  if (seconds <= 0) return { text: "AO VIVO AGORA", live: true };
  if (seconds < 60) return { text: "COMEÇA EM INSTANTES", live: false };
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return { text: `COMEÇA EM ${mins} MINUTO${mins > 1 ? "S" : ""}`, live: false };
  const hours = Math.floor(mins / 60);
  return { text: `COMEÇA EM ${hours} HORA${hours > 1 ? "S" : ""}`, live: false };
}

/** Máscara brasileira: (11) 99999-9999. Outros DDIs ficam só com os dígitos. */
function maskPhone(raw: string, countryCode: string): string {
  const d = raw.replace(/\D/g, "").slice(0, countryCode === "+55" ? 11 : 15);
  if (countryCode !== "+55") return d;
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Relógio compartilhado: 1 tique por segundo, 0 no servidor. */
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

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SignupForm({
  webinarId,
  availableTimes,
  timezone,
  type,
  jitIntervalMinutes,
  durationSeconds,
  recurrenceEnabled,
  recurrenceFreq,
  recurrenceDays,
  formFields,
  buttonLabel,
  buttonColor,
  buttonTextColor,
}: Props) {
  const [state, formAction, pending] = useActionState<RegistrationState, FormData>(
    createRegistration,
    undefined
  );

  // Os horários dependem de "agora", então só existem no cliente: no servidor o
  // relógio vale 0 e a caixa mostra "Carregando horários…". Sem isso o HTML do
  // servidor e o da hidratação divergiriam, e a contagem nasceria congelada.
  const now = useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);
  const mounted = now > 0;

  const isJit = type === "just_in_time";
  const isWeekly =
    !isJit && recurrenceEnabled && recurrenceFreq === "weekly" && (recurrenceDays?.length ?? 0) > 0;
  const useSlots = isJit || isWeekly;
  // A lista se refaz a cada 10s: quando a sessão em andamento acaba, ela sai
  // sozinha e a próxima assume — sem recalcular a cada tique do contador.
  const slotsAnchor = Math.floor(now / 10_000);
  const slots = useMemo<JitSlot[]>(() => {
    if (!useSlots || !slotsAnchor) return [];
    const nowMs = slotsAnchor * 10_000;
    return isJit
      ? jitSlots({ intervalMinutes: jitIntervalMinutes, durationSeconds, timezone, nowMs })
      : recurrenceSlots({ times: availableTimes, days: recurrenceDays, durationSeconds, timezone, nowMs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsAnchor, useSlots, isJit, jitIntervalMinutes, durationSeconds, timezone]);

  // A escolha é guardada pelo instante de início, não pelo índice: assim ela
  // sobrevive à lista se refazer, e cai na primeira sessão se aquela acabou.
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const slot = slots.find((s) => s.startMs === selectedStart) ?? slots[0];

  const today = mounted ? zonedParts(now, timezone).date : "";
  const [pickedDate, setPickedDate] = useState("");
  const date = pickedDate || today;
  const [time, setTime] = useState(availableTimes[0] ?? "20:00");

  const [countryCode, setCountryCode] = useState("+55");
  const [phone, setPhone] = useState("");

  const enabled = useMemo(() => {
    const byKey = new Map((formFields ?? []).map((f) => [f.key, f]));
    return (["name", "email", "whatsapp"] as const)
      .map((key) => {
        const f = byKey.get(key);
        return {
          key,
          enabled: f?.enabled ?? true,
          required: f?.required ?? key !== "whatsapp",
          label: f?.label?.trim() || FIELD_DEFAULTS[key].label,
        };
      })
      .filter((f) => f.enabled);
  }, [formFields]);

  const field = (key: FormField["key"]) => enabled.find((f) => f.key === key);
  const nameField = field("name");
  const emailField = field("email");
  const phoneField = field("whatsapp");

  const status = slot && mounted ? slotStatus(slot, now) : null;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="webinarId" value={webinarId} />

      {/* ---- Escolha da sessão ---- */}
      {useSlots ? (
        <div>
          <span className={capLabel}>Escolha sua data</span>
          {/* O servidor remonta o instante a partir de date + time. */}
          <input type="hidden" name="date" value={slot?.date ?? ""} />
          <input type="hidden" name="time" value={slot?.time ?? ""} />

          <div className="relative flex items-center gap-3 rounded-[12px] border-2 border-[color:var(--cap-ink)] bg-white px-4 py-3">
            <span className="text-[color:var(--cap-ink)]">
              <CalendarIcon />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[17px] font-bold text-[color:var(--cap-ink)]">
                {slot && mounted ? slotWhen(slot, timezone, now) : "Carregando horários…"}
              </span>
              {status && (
                <span
                  className="mt-0.5 block text-[12px] font-bold uppercase tracking-[0.06em]"
                  style={{ color: status.live ? "#dc2626" : "var(--cap-live)" }}
                >
                  {status.text}
                </span>
              )}
            </span>
            <span className="text-[color:var(--cap-ink)]">
              <ChevronIcon />
            </span>

            {/* Select nativo por cima: o visual é o da caixa acima, mas quem abre
                é o seletor do sistema (melhor no celular e no teclado). */}
            {slots.length > 0 && (
              <select
                aria-label="Escolha sua data"
                value={slot?.startMs ?? ""}
                onChange={(e) => setSelectedStart(Number(e.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                {slots.map((s) => (
                  <option key={s.startMs} value={s.startMs}>
                    {`${slotWhen(s, timezone, now || s.startMs)} — ${slotStatus(s, now || s.startMs).text.toLowerCase()}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {mounted && slots.length === 0 && (
            <p className="mt-2 text-[14px] text-[color:var(--cap-muted)]">
              Nenhuma sessão disponível agora.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={capLabel} htmlFor="cap-date">
              Escolha sua data
            </label>
            <input
              id="cap-date"
              name="date"
              type="date"
              required
              value={date}
              min={date}
              onChange={(e) => setPickedDate(e.target.value)}
              className={`${capInput} [color-scheme:light]`}
            />
          </div>
          <div>
            <label className={capLabel} htmlFor="cap-time">
              Horário
            </label>
            <select
              id="cap-time"
              name="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={capInput}
            >
              {availableTimes.map((t) => (
                <option key={t} value={t}>
                  {hourLabel(t)}
                </option>
              ))}
              {!availableTimes.includes(time) && <option value={time}>{hourLabel(time)}</option>}
            </select>
          </div>
        </div>
      )}

      {/* ---- Dados ---- */}
      {nameField && (
        <div>
          <label className={capLabel} htmlFor="cap-name">
            {nameField.label}
          </label>
          <input
            id="cap-name"
            name="name"
            required
            autoComplete="name"
            placeholder={FIELD_DEFAULTS.name.placeholder}
            className={capInput}
          />
        </div>
      )}

      {emailField && (
        <div>
          <label className={capLabel} htmlFor="cap-email">
            {emailField.label}
          </label>
          <input
            id="cap-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={FIELD_DEFAULTS.email.placeholder}
            className={capInput}
          />
        </div>
      )}

      {phoneField && (
        <div>
          <label className={capLabel} htmlFor="cap-phone">
            {phoneField.label}
          </label>
          {/* O action lê um campo `phone` só: DDI + número entram já juntos. */}
          <input type="hidden" name="phone" value={phone ? `${countryCode} ${phone}` : ""} />
          <div className="flex gap-3">
            <select
              aria-label="Código do país"
              value={countryCode}
              onChange={(e) => {
                setCountryCode(e.target.value);
                setPhone((p) => maskPhone(p, e.target.value));
              }}
              className={`${capFieldBase} w-[108px] shrink-0 px-3 text-[15px]`}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <input
              id="cap-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required={phoneField.required}
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value, countryCode))}
              placeholder={FIELD_DEFAULTS.whatsapp.placeholder}
              className={capInput}
            />
          </div>
        </div>
      )}

      {state?.error && (
        <p className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || (useSlots && mounted && slots.length === 0)}
        style={{ background: buttonColor, color: buttonTextColor }}
        className="w-full rounded-[10px] px-4 py-[17px] text-[17px] font-extrabold uppercase tracking-[0.02em] shadow-sm transition hover:brightness-[0.94] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Confirmando…" : buttonLabel}
      </button>
    </form>
  );
}
