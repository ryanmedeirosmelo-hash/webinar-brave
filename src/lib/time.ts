import { fromZonedTime } from "date-fns-tz";
import type { Webinar } from "@/types/db";

/** Monta o instante UTC a partir de "2026-06-16" + "20:00" num fuso. */
export function buildScheduledStartAt(
  date: string,
  time: string,
  timezone: string
): Date {
  // date: "YYYY-MM-DD", time: "HH:mm"
  const localIso = `${date}T${time}:00`;
  return fromZonedTime(localIso, timezone); // retorna Date em UTC
}

/** Formata segundos em "hh:mm:ss" (para inputs de duração). */
export function formatDuration(total: number): string {
  const t = Math.max(0, Math.round(total));
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = t % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Segundos decorridos desde o início agendado (pode ser negativo). */
export function elapsedSeconds(
  scheduledStartAtIso: string,
  nowMs = Date.now()
): number {
  const start = new Date(scheduledStartAtIso).getTime();
  return (nowMs - start) / 1000;
}

/** Cadastro dos webinars recorrentes (aula-seg/aula-qui) abre 8h antes do início. */
export const REGISTRATION_LEAD_HOURS = 8;
export const REGISTRATION_LEAD_MS = REGISTRATION_LEAD_HOURS * 3_600_000;

/**
 * Depois que a aula encerra, a OFERTA continua na tela de "aula encerrada" até
 * este horário (fuso do webinar). Antes disso a sala cortava seco no fim e quem
 * ainda estava decidindo comprar perdia o link do checkout.
 */
export const POST_LIVE_OFFER_UNTIL = "22:00";

/** Instante do horário `time` ("HH:mm") no DIA LOCAL de `ms`, no fuso `tz`. */
export function zonedTimeOnDayOf(ms: number, tz: string, time: string): number {
  return buildScheduledStartAt(zonedParts(ms, tz).date, time, tz).getTime();
}

/** A oferta ainda vale na tela de encerrado? Do fim da aula até
 *  POST_LIVE_OFFER_UNTIL do mesmo dia da sessão (fuso do webinar). */
export function postLiveOfferOpen(
  sessionStartMs: number,
  timezone: string,
  nowMs = Date.now()
): boolean {
  if (!Number.isFinite(sessionStartMs)) return false;
  return nowMs < zonedTimeOnDayOf(sessionStartMs, timezone, POST_LIVE_OFFER_UNTIL);
}

/** Dia da semana ISO (1=segunda … 7=domingo) de uma data "YYYY-MM-DD". */
export function isoWeekday(dateStr: string): number {
  // Meio-dia UTC evita qualquer ambiguidade de borda; só o calendário importa.
  const d = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=domingo … 6=sábado
  return d === 0 ? 7 : d;
}

/** Quebra um instante absoluto em {date:"YYYY-MM-DD", time:"HH:mm"} num fuso. */
export function zonedParts(
  ms: number,
  timezone: string
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

/**
 * Próximo início de sessão para a SALA DE ESPERA sem inscrição (landing = sala).
 * EVERGREEN e recorrente diariamente: nunca usa a data fixa passada (que jogava
 * a página em "encerrada"). Conta para o HORÁRIO do dia (ex.: 19:15) na próxima
 * ocorrência que ainda não terminou — hoje se ainda dá tempo, senão amanhã.
 *
 * O(s) horário(s) vêm de `available_times` e também da hora-do-dia do `start_at`
 * (assim um webinar de data fixa às 19:15 passa a contar 19:15 todo dia, sem
 * reconfigurar nada). Durante a aula (start ≤ agora < start+duração) retorna o
 * próprio start, então o player entra "ao vivo" sincronizado.
 */
export type SessionShape = Pick<
  Webinar,
  | "type"
  | "jit_interval_minutes"
  | "available_times"
  | "timezone"
  | "start_at"
  | "duration_seconds"
  | "recurrence_enabled"
  | "recurrence_freq"
  | "recurrence_days"
>;

/** Recorrência semanal por dia (ex.: seg/qui): só esses dias contam. */
function weeklyDaysOf(w: SessionShape): Set<number> | null {
  return w.recurrence_enabled && w.recurrence_freq === "weekly" && w.recurrence_days?.length
    ? new Set(w.recurrence_days)
    : null;
}

/** Horários-candidato do dia (HH:mm): lista configurada + hora do start_at. */
function sessionTimesOf(w: SessionShape): Set<string> {
  const times = new Set((w.available_times ?? []).filter(Boolean));
  if (w.start_at) {
    const t = new Date(w.start_at).getTime();
    if (!Number.isNaN(t)) times.add(zonedParts(t, w.timezone).time);
  }
  return times;
}

export function nextSessionStart(w: SessionShape, nowMs = Date.now()): Date {
  const tz = w.timezone;
  const durMs = Math.max(0, w.duration_seconds || 0) * 1000;
  const weeklyDays = weeklyDaysOf(w);
  const times = sessionTimesOf(w);

  if (times.size > 0) {
    // Menor início (cronologicamente) que ainda NÃO encerrou.
    let best = Infinity;
    for (let day = 0; day < 8; day++) {
      const { date } = zonedParts(nowMs + day * 86_400_000, tz);
      if (weeklyDays && !weeklyDays.has(isoWeekday(date))) continue; // pula dias fora da recorrência
      for (const time of times) {
        const start = buildScheduledStartAt(date, time, tz).getTime();
        if (start + durMs > nowMs && start < best) best = start;
      }
    }
    if (best !== Infinity) return new Date(best);
  }

  // Sem horário definido: cai no modo just-in-time (próximo múltiplo do intervalo).
  const interval = Math.max(1, Math.floor(w.jit_interval_minutes || 15));
  const { date, time } = zonedParts(nowMs, tz);
  const [h, m] = time.split(":").map(Number);
  const flooredMsm = Math.floor((h * 60 + m) / interval) * interval;
  const slotTime = `${String(Math.floor(flooredMsm / 60)).padStart(2, "0")}:${String(
    flooredMsm % 60
  ).padStart(2, "0")}`;
  let next = buildScheduledStartAt(date, slotTime, tz).getTime();
  while (next <= nowMs) next += interval * 60_000;
  return new Date(next);
}

/**
 * Início da última sessão de HOJE que JÁ ENCERROU (fuso do webinar), ou null se
 * hoje não é dia de aula / a aula de hoje ainda não acabou. Espelho de
 * `nextSessionStart` (mesmos horários, mesmo filtro de dia) — usado pra saber
 * que live acabou de terminar e ainda merece a oferta na tela de encerrado.
 */
export function lastEndedSessionToday(w: SessionShape, nowMs = Date.now()): Date | null {
  const tz = w.timezone;
  const durMs = Math.max(0, w.duration_seconds || 0) * 1000;
  const weeklyDays = weeklyDaysOf(w);
  const { date } = zonedParts(nowMs, tz);
  if (weeklyDays && !weeklyDays.has(isoWeekday(date))) return null;

  let best = -Infinity;
  for (const time of sessionTimesOf(w)) {
    const start = buildScheduledStartAt(date, time, tz).getTime();
    if (start + durMs <= nowMs && start > best) best = start;
  }
  return best === -Infinity ? null : new Date(best);
}

export type JitSlot = {
  date: string; // YYYY-MM-DD no fuso
  time: string; // HH:mm no fuso
  startMs: number; // instante absoluto de início
  /** (agora − início) em segundos. > 0 = sessão já em andamento. */
  offsetSeconds: number;
};

/**
 * Sessões "Just in time": a sessão EM ANDAMENTO (agora arredondado pra baixo no
 * intervalo) seguida das próximas. A em-andamento só entra na lista enquanto a
 * aula ainda não acabou (offset < duração) — assim o atrasado cai direto nela.
 */
export function jitSlots(opts: {
  intervalMinutes: number;
  durationSeconds: number;
  timezone: string;
  upcoming?: number;
  nowMs?: number;
}): JitSlot[] {
  const interval = Math.max(1, Math.floor(opts.intervalMinutes));
  const upcoming = opts.upcoming ?? 3;
  const now = opts.nowMs ?? Date.now();

  // Minuto atual no fuso → arredonda pra baixo no intervalo.
  const { date, time } = zonedParts(now, opts.timezone);
  const [h, m] = time.split(":").map(Number);
  const flooredMsm = Math.floor((h * 60 + m) / interval) * interval;
  const slotTime = `${String(Math.floor(flooredMsm / 60)).padStart(2, "0")}:${String(
    flooredMsm % 60
  ).padStart(2, "0")}`;
  const currentStart = buildScheduledStartAt(date, slotTime, opts.timezone).getTime();

  const slots: JitSlot[] = [];
  const currentOffset = (now - currentStart) / 1000;
  // Sessão em andamento — só oferece enquanto a aula ainda está rolando.
  if (currentOffset < opts.durationSeconds) {
    slots.push({
      ...zonedParts(currentStart, opts.timezone),
      startMs: currentStart,
      offsetSeconds: currentOffset,
    });
  }
  // Próximas sessões.
  for (let i = 1; i <= upcoming; i++) {
    const startMs = currentStart + i * interval * 60_000;
    slots.push({
      ...zonedParts(startMs, opts.timezone),
      startMs,
      offsetSeconds: (now - startMs) / 1000,
    });
  }
  return slots;
}

/**
 * Sessões de RECORRÊNCIA SEMANAL: próximas ocorrências nos dias da semana
 * permitidos (1=seg … 7=dom) nos horários de `times`. A ocorrência em andamento
 * (já começou, mas ainda no ar) entra como "ao vivo" — igual ao JIT, o atrasado
 * cai direto nela. Usada pelo formulário de inscrição de webinar recorrente.
 */
export function recurrenceSlots(opts: {
  times: string[];
  days: number[]; // ISO 1..7
  durationSeconds: number;
  timezone: string;
  upcoming?: number;
  nowMs?: number;
}): JitSlot[] {
  const now = opts.nowMs ?? Date.now();
  const tz = opts.timezone;
  const durMs = Math.max(0, opts.durationSeconds) * 1000;
  const days = new Set(opts.days);
  const times = (opts.times ?? []).filter(Boolean);
  const upcoming = opts.upcoming ?? 4;

  const slots: JitSlot[] = [];
  // Varre ~3 semanas adiante — suficiente para juntar as próximas ocorrências.
  for (let day = 0; day < 21; day++) {
    const { date } = zonedParts(now + day * 86_400_000, tz);
    if (days.size && !days.has(isoWeekday(date))) continue;
    for (const time of times) {
      const startMs = buildScheduledStartAt(date, time, tz).getTime();
      if (startMs + durMs <= now) continue; // já encerrou
      slots.push({ date, time, startMs, offsetSeconds: (now - startMs) / 1000 });
    }
  }
  slots.sort((a, b) => a.startMs - b.startMs);
  return slots.slice(0, upcoming);
}
