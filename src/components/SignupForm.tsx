"use client";

import { useActionState, useState } from "react";
import { createRegistration, type RegistrationState } from "@/app/actions/registrations";
import { jitSlots, recurrenceSlots, type JitSlot } from "@/lib/time";
import type { WebinarType } from "@/types/db";

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
};

/** Texto do horário Just in time: "ao vivo" pra sessão em andamento. */
function jitLabel(slot: JitSlot): string {
  if (slot.offsetSeconds >= 0) {
    const mins = Math.floor(slot.offsetSeconds / 60);
    return mins < 1
      ? "🔴 Agora — ao vivo (acabou de começar)"
      : `🔴 Agora — ao vivo (começou há ${mins} min)`;
  }
  const mins = Math.ceil(-slot.offsetSeconds / 60);
  return `${slot.time} — começa em ${mins} min`;
}

/** Texto da sessão recorrente: "ao vivo" se em andamento, senão "qui., 19/06 às 19:15". */
function weeklyLabel(slot: JitSlot, timezone: string): string {
  if (slot.offsetSeconds >= 0) {
    const mins = Math.floor(slot.offsetSeconds / 60);
    return mins < 1
      ? "🔴 Agora — ao vivo (acabou de começar)"
      : `🔴 Agora — ao vivo (começou há ${mins} min)`;
  }
  const when = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
  }).format(new Date(slot.startMs));
  return `${when} às ${slot.time}`;
}

/** Retorna {date:"YYYY-MM-DD", time:"HH:mm"} de "agora + minutes" no fuso informado. */
function nowPlusInTimezone(minutes: number, timezone: string) {
  const target = new Date(Date.now() + minutes * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(target);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
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
}: Props) {
  const [state, formAction, pending] = useActionState<RegistrationState, FormData>(
    createRegistration,
    undefined
  );
  const todayStr = nowPlusInTimezone(0, timezone).date;
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState(availableTimes[0] ?? "20:00");

  // Just in time: sessão em andamento + próximas. O atrasado cai na "ao vivo".
  const isJit = type === "just_in_time";
  // Recorrência semanal (ex.: seg/qui): só os dias permitidos viram opção.
  const isWeekly =
    !isJit && recurrenceEnabled && recurrenceFreq === "weekly" && (recurrenceDays?.length ?? 0) > 0;
  const useSlots = isJit || isWeekly;
  const [slots] = useState<JitSlot[]>(() =>
    isJit
      ? jitSlots({ intervalMinutes: jitIntervalMinutes, durationSeconds, timezone })
      : isWeekly
        ? recurrenceSlots({ times: availableTimes, days: recurrenceDays, durationSeconds, timezone })
        : []
  );
  const [slotIdx, setSlotIdx] = useState(0);
  const slot = slots[slotIdx];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="webinarId" value={webinarId} />

      <div>
        <label className="block text-sm font-medium text-slate-200 mb-1">Nome</label>
        <input
          name="name"
          required
          autoComplete="name"
          placeholder="Seu nome"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-200 mb-1">E-mail</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@email.com"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
      </div>

      {useSlots ? (
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">
            Sessão
          </label>
          {/* O server reconstrói o instante a partir de date + time. */}
          <input type="hidden" name="date" value={slot?.date ?? todayStr} />
          <input type="hidden" name="time" value={slot?.time ?? time} />
          {slots.length === 0 ? (
            <p className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-slate-400">
              Nenhuma sessão disponível agora.
            </p>
          ) : (
            <select
              required
              value={slotIdx}
              onChange={(e) => setSlotIdx(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white focus:border-cyan-400 focus:outline-none"
            >
              {slots.map((s, i) => (
                <option key={s.startMs} value={i}>
                  {isJit ? jitLabel(s) : weeklyLabel(s, timezone)}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Dia</label>
            <input
              name="date"
              type="date"
              required
              min={todayStr}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">Horário</label>
            <select
              name="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white focus:border-cyan-400 focus:outline-none"
            >
              {availableTimes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {/* permite o horário do teste just-in-time mesmo fora da lista */}
              {!availableTimes.includes(time) && <option value={time}>{time}</option>}
            </select>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">Fuso: {timezone}</p>

      {state?.error && (
        <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 px-4 py-3 font-semibold text-slate-900 transition"
      >
        {pending ? "Confirmando..." : "Garantir minha vaga"}
      </button>
    </form>
  );
}
