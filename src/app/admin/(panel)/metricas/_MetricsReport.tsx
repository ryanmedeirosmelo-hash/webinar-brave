"use client";

import { useEffect, useState } from "react";
import {
  getAllLives,
  getLiveDetail,
  type LiveRow,
  type LiveDetail,
  type RetentionCurvePoint,
} from "@/app/admin/actions";
import { displayTitle } from "@/components/Brand";
import { ADMIN_TIMEZONE } from "@/lib/brand";

const card =
  "rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-lg shadow-black/20 ring-1 ring-white/[0.02]";

function keyOf(l: { webinarId: string; sessionStart: string }) {
  return `${l.webinarId}|${l.sessionStart}`;
}

function splitKey(k: string): [string, string] {
  const i = k.lastIndexOf("|");
  return [k.slice(0, i), k.slice(i + 1)];
}

function pct(part: number, whole: number) {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

function fmtPos(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m${String(s).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  // "Qui · 03/07, 19:15" — o dia da semana diferencia aula-seg/aula-qui de cara
  const wd = d
    .toLocaleString("pt-BR", { timeZone: ADMIN_TIMEZONE, weekday: "short" })
    .replace(".", "");
  const rest = d.toLocaleString("pt-BR", {
    timeZone: ADMIN_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} · ${rest}`;
}

const POLL_MS = 10_000;

// ---------- Dia da semana / horário (a live é agendada no fuso de Brasília) ----------

const BRT = ADMIN_TIMEZONE;
const WD_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WD_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WD_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: BRT, weekday: "short" });
const hmFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRT,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Dia da semana (0=dom) da live, em Brasília. */
function weekdayOf(iso: string): number {
  return WD_INDEX[wdFmt.format(new Date(iso))] ?? 0;
}

/** Minuto do dia (0–1439) de um instante, em Brasília. */
function minutesOfDay(ms: number): number {
  const [h, m] = hmFmt.format(new Date(ms)).split(":").map(Number);
  return h * 60 + m;
}

function fmtClock(minutesOfDayValue: number): string {
  const total = Math.round(minutesOfDayValue) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Mediana — resiste a uma live atípica melhor que a média. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

type DetailTab = "resumo" | "audiencia";

type Period = "7" | "30" | "90" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "7", label: "7 dias" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "all", label: "Tudo" },
];

/** Filtro de dia da semana: "all" ou o índice (0=dom … 4=qui). */
type WeekdayFilter = "all" | number;

function filterLives(
  lives: LiveRow[],
  period: Period,
  webinarId: string,
  weekday: WeekdayFilter
): LiveRow[] {
  const cutoff =
    period === "all" ? 0 : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
  return lives.filter(
    (l) =>
      (webinarId === "all" || l.webinarId === webinarId) &&
      (cutoff === 0 || new Date(l.sessionStart).getTime() >= cutoff) &&
      (weekday === "all" || weekdayOf(l.sessionStart) === weekday)
  );
}

/** Números somados de um conjunto de lives (o "geral" de um dia da semana). */
type GroupStats = {
  label: string;
  weekday: WeekdayFilter;
  lives: number;
  invited: number; // todos os convidados do período
  invitedMeasured: number; // desses, os de lives com cadastro (dá pra saber quem veio)
  invitedAttended: number | null; // null = nenhuma live do grupo dá pra medir
  invitedRate: number | null; // vieram ÷ convidados MENSURÁVEIS
  registered: number;
  registeredAttended: number;
  plays: number;
  anonPlays: number;
  attendance: number | null; // inscritos presentes / inscritos (null = entrada livre)
  reachedEnd: number;
  endRate: number | null;
  peakMax: number;
  peakMedian: number | null; // pico típico de simultâneos
  peakClock: number | null; // horário (mediana) em que o pico acontece
  peakMinute: number | null; // minuto da live (mediana) em que o pico acontece
  purchases: number;
};

function statsOf(lives: LiveRow[], label: string, weekday: WeekdayFilter): GroupStats {
  // Convidados: só entram na taxa as lives em que dá pra medir quem veio (as de
  // entrada livre contam como convidados, mas não têm presença rastreável).
  const invited = lives.reduce((s, l) => s + l.invited, 0);
  const measurable = lives.filter((l) => l.invitedAttended !== null);
  const invitedMeasured = measurable.reduce((s, l) => s + l.invited, 0);
  const invitedAttended = measurable.length
    ? measurable.reduce((s, l) => s + (l.invitedAttended ?? 0), 0)
    : null;

  const registered = lives.reduce((s, l) => s + l.registered, 0);
  const registeredAttended = lives.reduce((s, l) => s + l.registeredAttended, 0);
  const plays = lives.reduce((s, l) => s + l.entered, 0);
  const reachedEnd = lives.reduce((s, l) => s + l.reachedEnd, 0);
  // só entram no "horário de pico" as lives que de fato tiveram gente
  const withPeak = lives.filter((l) => l.peak > 0 && l.peakAtSeconds !== null);
  const peakClocks = withPeak.map((l) =>
    minutesOfDay(new Date(l.sessionStart).getTime() + (l.peakAtSeconds as number) * 1000)
  );
  return {
    label,
    weekday,
    lives: lives.length,
    invited,
    invitedMeasured,
    invitedAttended,
    invitedRate:
      invitedAttended !== null && invitedMeasured > 0
        ? Math.round((invitedAttended / invitedMeasured) * 100)
        : null,
    registered,
    registeredAttended,
    plays,
    anonPlays: lives.reduce((s, l) => s + l.anonPlays, 0),
    // sem cadastro (entrada livre) não existe comparecimento — fica "—", não 1300%
    attendance: registered > 0 ? Math.round((registeredAttended / registered) * 100) : null,
    reachedEnd,
    endRate: plays > 0 ? Math.round((reachedEnd / plays) * 100) : null,
    peakMax: lives.reduce((s, l) => Math.max(s, l.peak), 0),
    peakMedian: median(withPeak.map((l) => l.peak)),
    peakClock: median(peakClocks),
    peakMinute: median(withPeak.map((l) => Math.round((l.peakAtSeconds as number) / 60))),
    purchases: lives.reduce((s, l) => s + l.purchases, 0),
  };
}

export function MetricsReport({ lives: initialLives }: { lives: LiveRow[] }) {
  const [lives, setLives] = useState<LiveRow[]>(initialLives);
  const [period, setPeriod] = useState<Period>("30");
  const [webinarFilter, setWebinarFilter] = useState<string>("all");
  const [weekday, setWeekday] = useState<WeekdayFilter>("all");
  const [selected, setSelected] = useState<string | null>(
    initialLives.length ? keyOf(initialLives[0]) : null
  );
  const [detail, setDetail] = useState<LiveDetail | null>(null);
  const [tab, setTab] = useState<DetailTab>("resumo");

  // detalhe da live selecionada (com poll enquanto ela continua selecionada)
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const [webinarId, sessionStart] = splitKey(selected);
    const load = () =>
      getLiveDetail(webinarId, sessionStart)
        .then((d) => {
          if (!cancelled) setDetail(d);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selected]);

  // poll da lista de lives (conta novas lives / atualiza números)
  useEffect(() => {
    const id = setInterval(() => {
      getAllLives()
        .then((next) => setLives(next))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  if (lives.length === 0) {
    return (
      <div className={`${card} text-center`}>
        <p className="text-slate-300 font-medium">Nenhuma live realizada ainda.</p>
        <p className="mt-1 text-sm text-slate-500">
          Assim que a primeira aula rodar, ela aparece aqui — com inscritos, presença e quem
          assistiu até o fim.
        </p>
      </div>
    );
  }

  const filtered = filterLives(lives, period, webinarFilter, weekday);
  const webinars = [...new Map(lives.map((l) => [l.webinarId, l])).values()];

  // troca de filtro: garante que a live selecionada continua visível
  const applyFilter = (p: Period, wf: string, wd: WeekdayFilter) => {
    setPeriod(p);
    setWebinarFilter(wf);
    setWeekday(wd);
    const f = filterLives(lives, p, wf, wd);
    if (!f.some((l) => keyOf(l) === selected)) {
      setSelected(f.length ? keyOf(f[0]) : null);
    }
  };

  // Comparativo por dia da semana — ignora o filtro de dia (senão só sobra 1 linha),
  // mas respeita período e webinar.
  const byWeekdayBase = filterLives(lives, period, webinarFilter, "all");
  const weekdaysPresent = [...new Set(byWeekdayBase.map((l) => weekdayOf(l.sessionStart)))].sort(
    (a, b) => a - b
  );
  const groups: GroupStats[] = [
    ...weekdaysPresent.map((wd) =>
      statsOf(
        byWeekdayBase.filter((l) => weekdayOf(l.sessionStart) === wd),
        WD_LABEL[wd],
        wd
      )
    ),
    statsOf(byWeekdayBase, "Geral", "all"),
  ];

  // resumo do período filtrado (respeita todos os filtros, inclusive o dia)
  const totals = statsOf(filtered, "Geral", weekday);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros: período + dia da semana + webinar */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyFilter(p.key, webinarFilter, weekday)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              period === p.key
                ? "bg-[#cbad78]/15 text-[#e3cfa0] ring-1 ring-[#cbad78]/40"
                : "text-slate-400 ring-1 ring-slate-800 hover:text-slate-200 hover:ring-slate-700"
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* Dia da semana: segunda x quinta (só aparecem os dias que existem) */}
        {weekdaysPresent.length > 1 && (
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              dia
            </span>
            {(["all", ...weekdaysPresent] as WeekdayFilter[]).map((wd) => (
              <button
                key={String(wd)}
                onClick={() => applyFilter(period, webinarFilter, wd)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  weekday === wd
                    ? "bg-[#cbad78]/15 text-[#e3cfa0] ring-1 ring-[#cbad78]/40"
                    : "text-slate-400 ring-1 ring-slate-800 hover:text-slate-200 hover:ring-slate-700"
                }`}
              >
                {wd === "all" ? "Todos" : WD_SHORT[wd as number]}
              </button>
            ))}
          </div>
        )}

        <select
          value={webinarFilter}
          onChange={(e) => applyFilter(period, e.target.value, weekday)}
          className="ml-auto rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-[#cbad78]/60"
        >
          <option value="all">Todos os webinars</option>
          {webinars.map((w) => (
            <option key={w.webinarId} value={w.webinarId}>
              /{w.slug}
            </option>
          ))}
        </select>
      </div>

      {/* Resumo do período (com o filtro de dia aplicado) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Lives no período", value: String(totals.lives) },
          { label: "Plays únicos (soma)", value: String(totals.plays) },
          {
            label: "Tx de comparecimento",
            value: totals.invitedRate !== null ? `${totals.invitedRate}%` : "—",
            sub:
              totals.invitedRate !== null
                ? `${totals.invitedAttended} de ${totals.invitedMeasured} convidados` +
                  (totals.invited > totals.invitedMeasured
                    ? ` (+${totals.invited - totals.invitedMeasured} sem cadastro)`
                    : "")
                : totals.invited > 0
                  ? `${totals.invited} convidados · sem cadastro`
                  : "sem disparo no dia",
          },
          {
            label: "Horário de pico",
            value: totals.peakClock !== null ? fmtClock(totals.peakClock) : "—",
            sub:
              totals.peakMinute !== null
                ? `aos ${totals.peakMinute} min de live`
                : undefined,
          },
          { label: "Até o fim (soma)", value: String(totals.reachedEnd) },
          { label: "💰 Compras", value: String(totals.purchases) },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-800/80 bg-slate-900/40 px-3.5 py-2.5"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {s.label}
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{s.value}</p>
            {s.sub && <p className="text-[11px] text-slate-500 tabular-nums">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Comparativo por dia da semana (segunda x quinta) */}
      {weekdaysPresent.length > 1 && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              📅 Por dia da semana
            </p>
            <p className="text-[11px] text-slate-600">
              clique numa linha pra filtrar as lives ao lado
            </p>
          </div>
          <div className="overflow-x-auto px-2 pb-2 pt-2">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-600">
                  <th className="px-2 py-1.5 font-semibold">Dia</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Lives</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Convidados</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Vieram</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Comparecimento</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Inscritos</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Plays</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Horário de pico</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Pico</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Até o fim</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Compras</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const isTotal = g.weekday === "all";
                  const active = weekday === g.weekday;
                  return (
                    <tr
                      key={g.label}
                      onClick={() => applyFilter(period, webinarFilter, g.weekday)}
                      className={`cursor-pointer border-t border-slate-800/80 transition ${
                        active ? "bg-[#cbad78]/10" : "hover:bg-slate-800/40"
                      } ${isTotal ? "font-semibold" : ""}`}
                    >
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className={isTotal ? "text-slate-300" : "text-white"}>
                          {g.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-400">
                        {g.lives}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-300">
                        {g.invited || "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-300">
                        {g.invitedAttended ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                        {g.invitedRate !== null ? (
                          <>
                            <span className="font-bold text-[#e3cfa0]">{g.invitedRate}%</span>
                            {g.invited > g.invitedMeasured && (
                              <span
                                className="ml-1 text-[11px] text-slate-500"
                                title={`${g.invited - g.invitedMeasured} convidados são de aulas de entrada livre e ficam de fora da conta.`}
                              >
                                de {g.invitedMeasured}
                              </span>
                            )}
                          </>
                        ) : (
                          <span
                            className="text-slate-500"
                            title="Aula de entrada livre: sem cadastro não há telefone pra cruzar com o disparo, então não dá pra saber quem dos convidados veio."
                          >
                            — sem cadastro
                          </span>
                        )}
                      </td>
                      <td
                        className="px-2 py-2 text-right tabular-nums text-slate-300 whitespace-nowrap"
                        title={`${g.registeredAttended} dos ${g.registered} inscritos entraram na sala`}
                      >
                        {g.registered}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-white whitespace-nowrap">
                        {g.plays}
                        {g.anonPlays > 0 && (
                          <span className="ml-1 text-[11px] text-slate-500">
                            {g.anonPlays} anôn.
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-300 whitespace-nowrap">
                        {g.peakClock !== null ? (
                          <>
                            {fmtClock(g.peakClock)}
                            <span className="ml-1 text-[11px] text-slate-500">
                              ({g.peakMinute} min)
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-300 whitespace-nowrap">
                        {g.peakMedian ?? 0}
                        <span className="ml-1 text-[11px] text-slate-500">máx {g.peakMax}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-300 whitespace-nowrap">
                        {g.reachedEnd}
                        {g.endRate !== null && (
                          <span className="ml-1 text-[11px] text-emerald-400">{g.endRate}%</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-300">
                        {g.purchases}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-3 text-[11px] text-slate-500">
            Convidados = quem recebeu disparo de WhatsApp no dia da aula (lido do CRM).
            Comparecimento = desses convidados, quantos entraram na sala — cruzando o telefone do
            disparo com o do cadastro. Aula de entrada livre não tem cadastro, então dá pra saber
            quantos foram convidados mas não quantos vieram. Horário de pico = mediana do
            horário (Brasília) em que a live bate o máximo de simultâneos; entre parênteses, o
            minuto da aula. Pico = mediana por live (máx = maior pico registrado).
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* Lista de lives realizadas */}
      <aside className="flex flex-col gap-2">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Lives no período ({filtered.length})
        </p>
        <div className="space-y-2 pr-1">
          {filtered.length === 0 && (
            <p className="px-1 text-sm text-slate-500">Nenhuma live neste período.</p>
          )}
          {filtered.map((l) => {
            const k = keyOf(l);
            const active = k === selected;
            return (
              <button
                key={k}
                onClick={() => setSelected(k)}
                className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                  active
                    ? "border-[#cbad78]/60 bg-[#cbad78]/10 ring-1 ring-[#cbad78]/25"
                    : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {fmtDate(l.sessionStart)}
                  </span>
                  {l.isLive && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      ao vivo
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">/{l.slug}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                  <span>
                    <span className="font-semibold text-slate-200 tabular-nums">{l.entered}</span>{" "}
                    plays
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>
                    pico{" "}
                    <span className="font-semibold text-slate-200 tabular-nums">{l.peak}</span>
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>
                    <span className="font-semibold text-slate-200 tabular-nums">
                      {l.reachedEnd}
                    </span>{" "}
                    até o fim
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Detalhe da live selecionada */}
      <section className="min-w-0 pr-1 pb-2 lg:pb-4">
        {detail && selected === keyOf(detail) ? (
          <LiveDetailView d={detail} tab={tab} onTab={setTab} />
        ) : selected ? (
          <div className={`${card} text-sm text-slate-500`}>Carregando…</div>
        ) : (
          <div className={`${card} text-sm text-slate-500`}>
            Selecione uma live na lista ao lado.
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

/** Tile uniforme do funil: rótulo, número grande e um complemento. */
function StatTile({
  label,
  value,
  badge,
  badgeColor,
  sub,
}: {
  label: string;
  value: number;
  badge?: string | null;
  badgeColor?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white">
        {value}
        {badge && (
          <span className={`ml-1.5 text-xs font-semibold ${badgeColor ?? "text-[#cbad78]"}`}>
            {badge}
          </span>
        )}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

/** Curva de retenção estilo VTurb: % dos plays presentes em cada minuto da live. */
function RetentionChart({
  points,
  pitchAt,
}: {
  points: RetentionCurvePoint[];
  pitchAt: number | null;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 200;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const maxS = points[points.length - 1].atSeconds || 1;
  const x = (s: number) => padL + (s / maxS) * (W - padL - padR);
  const y = (p: number) => padT + (1 - p / 100) * (H - padT - padB);
  const pctOf = (p: RetentionCurvePoint) => p.pct ?? 0;

  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(p.atSeconds).toFixed(1)},${y(pctOf(p)).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(maxS).toFixed(1)},${y(0).toFixed(1)} L${x(
    points[0].atSeconds
  ).toFixed(1)},${y(0).toFixed(1)} Z`;

  // marcações do eixo X em minutos "redondos" (no máx. ~8 rótulos)
  const totalMin = maxS / 60;
  const stepMin = [5, 10, 15, 30, 60].find((s) => totalMin / s <= 8) ?? 120;
  const ticks: number[] = [];
  for (let m = stepMin; m < totalMin - stepMin / 2; m += stepMin) ticks.push(m);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const s = ((vx - padL) / (W - padL - padR)) * maxS;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.atSeconds - s);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;
  const tooltipFlip = hp !== null && x(hp.atSeconds) > W - 150;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full select-none"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="ret-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cbad78" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#cbad78" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* grade + eixo Y (%) */}
      {[0, 25, 50, 75, 100].map((p) => (
        <g key={p}>
          <line x1={padL} x2={W - padR} y1={y(p)} y2={y(p)} stroke="#1e293b" strokeWidth="1" />
          <text x={padL - 6} y={y(p) + 3} textAnchor="end" fontSize="9" fill="#64748b">
            {p}%
          </text>
        </g>
      ))}

      {/* eixo X (minutos da live) */}
      {ticks.map((m) => (
        <text key={m} x={x(m * 60)} y={H - 8} textAnchor="middle" fontSize="9" fill="#64748b">
          {m} min
        </text>
      ))}

      <path d={area} fill="url(#ret-fill)" />
      <path d={line} fill="none" stroke="#cbad78" strokeWidth="2" strokeLinejoin="round" />

      {/* momento do pitch */}
      {pitchAt !== null && pitchAt <= maxS && (
        <g>
          <line
            x1={x(pitchAt)}
            x2={x(pitchAt)}
            y1={padT}
            y2={y(0)}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.85"
          />
          <text
            x={x(pitchAt) > W - 70 ? x(pitchAt) - 4 : x(pitchAt) + 4}
            y={padT + 8}
            textAnchor={x(pitchAt) > W - 70 ? "end" : "start"}
            fontSize="9"
            fontWeight="700"
            fill="#fbbf24"
          >
            🎯 Pitch
          </text>
        </g>
      )}

      {/* hover: ponto + tooltip */}
      {hp && (
        <g>
          <line
            x1={x(hp.atSeconds)}
            x2={x(hp.atSeconds)}
            y1={padT}
            y2={y(0)}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <circle
            cx={x(hp.atSeconds)}
            cy={y(pctOf(hp))}
            r="3.5"
            fill="#e3cfa0"
            stroke="#020617"
            strokeWidth="1.5"
          />
          <g
            transform={`translate(${
              tooltipFlip ? x(hp.atSeconds) - 138 : x(hp.atSeconds) + 8
            }, ${padT + 2})`}
          >
            <rect width="130" height="34" rx="6" fill="#0f172a" stroke="#334155" strokeWidth="1" />
            <text x="8" y="14" fontSize="9.5" fontWeight="700" fill="#e2e8f0">
              {fmtPos(hp.atSeconds)} de live
            </text>
            <text x="8" y="27" fontSize="9.5" fill="#cbad78">
              {hp.count} {hp.count === 1 ? "pessoa" : "pessoas"}
              {hp.pct !== null ? ` · ${hp.pct}%` : ""}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}

function LiveDetailView({
  d,
  tab,
  onTab,
}: {
  d: LiveDetail;
  tab: DetailTab;
  onTab: (t: DetailTab) => void;
}) {
  // comparecimento = inscritos que entraram ÷ inscritos (não plays ÷ inscritos:
  // com anônimos na sala isso passa de 100% e não quer dizer nada)
  const attendance = pct(d.registeredAttended, d.registered);
  const endRate = pct(d.reachedEnd, d.entered);

  const tabBtn = (t: DetailTab, label: string) => (
    <button
      onClick={() => onTab(t)}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
        tab === t
          ? "bg-[#cbad78]/15 text-[#e3cfa0] ring-1 ring-[#cbad78]/40"
          : "text-slate-400 ring-1 ring-slate-800 hover:text-slate-200 hover:ring-slate-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Cabeçalho da live + abas — fica grudado no topo enquanto rola */}
      <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-[#020617]/95 px-1 pb-1 pt-0.5 backdrop-blur">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3 !py-4`}>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">
            {displayTitle(d.webinarTitle)}
          </h2>
          <p className="text-sm text-slate-400">
            Live de{" "}
            <span className="font-semibold text-slate-200">{fmtDate(d.sessionStart)}</span>
            <span className="text-slate-500"> (Brasília) · /{d.slug}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {d.watchingNow > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-300 ring-1 ring-red-500/30">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              {d.watchingNow} assistindo agora
            </span>
          )}
          <a
            href={`/admin/webinars/${d.webinarId}`}
            className="text-xs text-[#cbad78] hover:text-[#e3cfa0]"
          >
            abrir webinar →
          </a>
        </div>
      </div>

      <div className="flex gap-2">
        {tabBtn("resumo", "📊 Resumo")}
        {tabBtn("audiencia", `👥 Audiência (${d.attendees.length})`)}
      </div>
      </div>

      {tab === "resumo" && (
      <>
      {/* 1 — Funil da live (do cadastro ao checkout) */}
      <div className={card}>
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          🎯 Funil da live
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="📝 Inscritos"
            value={d.registered}
            badge={attendance !== null ? `${attendance}%` : null}
            sub={
              attendance !== null
                ? `${d.registeredAttended} compareceram`
                : "entrada livre (sem cadastro)"
            }
          />
          <StatTile
            label="▶ Plays únicos"
            value={d.entered}
            sub="deram play (1 por navegador)"
          />
          <StatTile
            label="👥 Pico"
            value={d.peakViewers}
            sub={
              d.peakAtSeconds !== null
                ? `simultâneos · aos ${fmtPos(d.peakAtSeconds)}`
                : "simultâneos"
            }
          />
          <StatTile
            label="🏁 Até o fim"
            value={d.reachedEnd}
            badge={endRate !== null ? `${endRate}%` : null}
            badgeColor="text-emerald-400"
            sub="chegaram aos min finais"
          />
          <StatTile
            label="🛒 Oferta"
            value={d.offerClicks}
            badge={d.clickRate !== null ? `${d.clickRate}%` : null}
            badgeColor="text-emerald-400"
            sub="clicaram no checkout"
          />
          <StatTile
            label="💰 Compras"
            value={d.purchases}
            badge={d.purchaseRate !== null ? `${d.purchaseRate}%` : null}
            badgeColor="text-emerald-400"
            sub={
              d.revenue !== null
                ? d.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                : "aprovadas na Hotmart"
            }
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Da esquerda pra direita: do cadastro à venda. Percentuais: comparecimento = inscritos
          que entraram sobre inscritos; fim, oferta e compras sobre os plays. Compras chegam pelo
          webhook da Hotmart.
        </p>
      </div>

      {/* 2 — Retenção: curva minuto a minuto + marcos */}
      {(d.retention.length > 0 || d.pitchRetention || d.retentionCurve.length > 1) && (
        <div className={card}>
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            📈 Retenção (presentes no minuto)
          </div>
          {d.retentionCurve.length > 1 && (
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <RetentionChart
                points={d.retentionCurve}
                pitchAt={d.pitchRetention?.atSeconds ?? null}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {d.retention.map((r) => (
              <div
                key={r.atSeconds}
                className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-center"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {r.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">{r.count}</p>
                {r.pct !== null && (
                  <p className="text-xs font-semibold text-[#cbad78]">{r.pct}%</p>
                )}
              </div>
            ))}
            {d.pitchRetention && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                  🎯 Pitch ({fmtPos(d.pitchRetention.atSeconds)})
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                  {d.pitchRetention.count}
                </p>
                {d.pitchRetention.pct !== null && (
                  <p className="text-xs font-semibold text-amber-400">{d.pitchRetention.pct}%</p>
                )}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            % sobre os plays únicos. Conta quem estava na sala naquele minuto da live.
          </p>
        </div>
      )}
      </>
      )}

      {tab === "audiencia" && (
      <>
      {/* Aba Audiência: aparelhos, locais e quem assistiu */}
      {(d.byDevice.length > 0 || d.byLocation.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {d.byDevice.length > 0 && (
            <div className={card}>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                📱 Aparelhos
              </div>
              <ul className="space-y-1.5 text-sm">
                {d.byDevice.map((b) => (
                  <li key={b.label} className="flex items-center justify-between">
                    <span className="text-slate-300">{b.label}</span>
                    <span className="tabular-nums font-semibold text-white">{b.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.byLocation.length > 0 && (
            <div className={card}>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                📍 Locais
              </div>
              <ul className="space-y-1.5 text-sm">
                {d.byLocation.slice(0, 8).map((b) => (
                  <li key={b.label} className="flex items-center justify-between">
                    <span className="truncate text-slate-300">{b.label}</span>
                    <span className="ml-2 tabular-nums font-semibold text-white">{b.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tabela de espectadores */}
      {d.attendees.length > 0 && (
        <div className={card}>
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            👥 Espectadores desta live ({d.attendees.length})
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Pessoa</th>
                  <th className="px-3 py-2 font-medium">Local</th>
                  <th className="px-3 py-2 font-medium">Aparelho</th>
                  <th className="px-3 py-2 text-right font-medium">Na sala</th>
                  <th className="px-3 py-2 text-right font-medium">Assistiu até</th>
                </tr>
              </thead>
              <tbody>
                {d.attendees.map((v, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="px-3 py-2 tabular-nums text-slate-500 align-top">
                      <span className="inline-flex items-center gap-1.5">
                        {i + 1}
                        {v.live && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="assistindo agora" />
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {v.name ? (
                        <>
                          <div className="font-medium text-slate-100">{v.name}</div>
                          {v.email && <div className="text-xs text-slate-500">{v.email}</div>}
                        </>
                      ) : (
                        <span className="text-slate-500 italic">Anônimo (sem inscrição)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-200 align-top">{v.location ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300 align-top">
                      {[v.device, v.os, v.browser].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300 align-top">
                      {v.minutesInRoom} min
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400 align-top">
                      {fmtPos(v.positionSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Nome/e-mail de quem se inscreveu pelo formulário. Quem entra pelo link público sem se
            inscrever aparece como anônimo. Local por IP (aproximado). Ponto vermelho = assistindo
            agora.
          </p>
        </div>
      )}
      {d.attendees.length === 0 && (
        <div className={`${card} text-sm text-slate-500`}>
          Nenhum espectador registrado nesta live.
        </div>
      )}
      </>
      )}

      <p className="text-xs text-slate-500">Atualiza automaticamente a cada 10 segundos.</p>
    </div>
  );
}
