"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  getDisparoRecipients,
  type Disparo,
  type DisparoRecipient,
} from "@/app/admin/disparos";
import { ADMIN_TIMEZONE } from "@/lib/brand";

const card =
  "rounded-2xl border border-slate-800/80 bg-slate-900/50 shadow-lg shadow-black/20 ring-1 ring-white/[0.02]";

function fmtDay(day: string): string {
  const d = new Date(`${day}T12:00:00-03:00`);
  const wd = d
    .toLocaleString("pt-BR", { timeZone: ADMIN_TIMEZONE, weekday: "short" })
    .replace(".", "");
  const rest = d.toLocaleDateString("pt-BR", {
    timeZone: ADMIN_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
  });
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} · ${rest}`;
}

function fmtHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: ADMIN_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Traduz os códigos de erro do Meta (formato "#131049 · title · message …").
function explainMetaError(raw: string): string {
  const code = raw.match(/#(\d+)/)?.[1];
  switch (code) {
    case "131049":
      return "Meta limitou o envio pra preservar a qualidade do número (#131049).";
    case "131026":
      return "Número não existe no WhatsApp ou está inativo (#131026).";
    case "131047":
      return "Janela de 24h expirou — só template, não texto livre (#131047).";
    case "132000":
      return "Template com parâmetros faltando ou inválidos (#132000).";
    case "132001":
      return "Template não aprovado ou desabilitado (#132001).";
    case "133015":
      return "Conta Meta pausada — verifique o Business Manager (#133015).";
    case "368":
      return "Mensagem temporariamente bloqueada pela política do Meta (#368).";
    default:
      return code ? `Meta retornou erro #${code}.` : raw;
  }
}

// ─── As 4 mensagens de todo webinar ─────────────────────────────────────────

type SlotType = "convite" | "cade_voce" | "falta_1h" | "ao_vivo";

const SLOTS: { type: SlotType; emoji: string; label: string; hint: string }[] = [
  { type: "convite", emoji: "📨", label: "Convite", hint: "enviado nos dias antes da aula" },
  { type: "cade_voce", emoji: "👀", label: "Cadê você? (é hoje)", hint: "lembrete no dia da aula" },
  { type: "falta_1h", emoji: "⏰", label: "Falta 1 hora", hint: "1h antes de começar" },
  { type: "ao_vivo", emoji: "🔴", label: "Ao vivo", hint: "na hora que a aula abre" },
];

/** Classifica um disparo pelo nome do fluxo no CRM. */
function slotOf(d: Disparo): SlotType | null {
  const n = d.flowName.toLowerCase();
  if (/resposta/.test(n)) return null; // respostas ao convite → "outras mensagens"
  if (/convite/.test(n)) return "convite";
  if (/cad[eê]|é hoje|e hoje/.test(n)) return "cade_voce";
  if (/falta (1|uma)/.test(n)) return "falta_1h";
  if (/ao vivo/.test(n)) return "ao_vivo";
  return null;
}

/**
 * A que webinar o disparo pertence: mensagens do dia da aula (cadê você,
 * falta 1h, ao vivo) ficam no próprio dia; o convite conta pro PRÓXIMO
 * webinar (segunda ou quinta) a partir do dia em que saiu.
 */
function sessionDayOf(d: Disparo, slot: SlotType): string {
  if (slot !== "convite") return d.day;
  const date = new Date(`${d.day}T12:00:00-03:00`);
  for (let i = 0; i < 7; i++) {
    const wd = date.toLocaleString("en-US", { timeZone: ADMIN_TIMEZONE, weekday: "short" });
    if (wd === "Mon" || wd === "Thu") break;
    date.setDate(date.getDate() + 1);
  }
  return date.toLocaleDateString("en-CA", { timeZone: ADMIN_TIMEZONE });
}

/** Aula é seg/qui — é o que define quais dias DEVEM ter os 4 disparos. */
function isSessionDay(day: string): boolean {
  const wd = new Date(`${day}T12:00:00-03:00`).toLocaleString("en-US", {
    timeZone: ADMIN_TIMEZONE,
    weekday: "short",
  });
  return wd === "Mon" || wd === "Thu";
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00-03:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: ADMIN_TIMEZONE });
}

function weekdayName(day: string): string {
  const wd = new Date(`${day}T12:00:00-03:00`).toLocaleString("pt-BR", {
    timeZone: ADMIN_TIMEZONE,
    weekday: "long",
  });
  return wd.replace("-feira", "");
}

type Session = {
  day: string;
  slots: Record<SlotType, Disparo[]>;
};

function buildSessions(
  disparos: Disparo[],
  today: string
): { sessions: Session[]; outras: Disparo[] } {
  const byDay = new Map<string, Session>();
  const outras: Disparo[] = [];
  const empty = (): Session["slots"] => ({
    convite: [],
    cade_voce: [],
    falta_1h: [],
    ao_vivo: [],
  });
  for (const d of disparos) {
    const slot = slotOf(d);
    if (!slot) {
      outras.push(d);
      continue;
    }
    const day = sessionDayOf(d, slot);
    let s = byDay.get(day);
    if (!s) {
      s = { day, slots: empty() };
      byDay.set(day, s);
    }
    s.slots[slot].push(d);
  }

  // Uma aula em que NADA saiu não tem linha nenhuma no CRM — sem isto ela
  // simplesmente não apareceria, e "não teve disparo" fica indistinguível de
  // "o painel não carregou". Então preenchemos todo seg/qui até hoje.
  const known = [...byDay.keys()].sort();
  for (let day = known[0]; day && day <= today; day = addDays(day, 1)) {
    if (isSessionDay(day) && !byDay.has(day)) byDay.set(day, { day, slots: empty() });
  }

  const sessions = [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  return { sessions, outras };
}

// ─── Página ─────────────────────────────────────────────────────────────────

export function DisparosReport({ disparos, today }: { disparos: Disparo[]; today: string }) {
  const [open, setOpen] = useState<{ label: string; sub: string; disparos: Disparo[] } | null>(null);
  const { sessions, outras } = buildSessions(disparos, today);

  if (disparos.length === 0) {
    return (
      <div className={`${card} p-10 text-center`}>
        <p className="text-sm text-slate-400">Nenhum disparo registrado ainda.</p>
        <p className="mt-1 text-xs text-slate-600">
          Quando as mensagens da próxima aula saírem, cada webinar aparece aqui com seus 4
          disparos: convite · cadê você · falta 1h · ao vivo.
        </p>
      </div>
    );
  }

  return (
    <>
      {sessions.map((s) => {
        const enviadas = SLOTS.filter((sl) => s.slots[sl.type].length > 0).length;
        const isToday = s.day === today;
        return (
        <div key={s.day} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <span>
                🎥 Webinar de {weekdayName(s.day)}{" "}
                <span className="text-[#cbad78]">
                  ·{" "}
                  {new Date(`${s.day}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
                    timeZone: ADMIN_TIMEZONE,
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </span>
              {isToday && (
                <span className="rounded-full bg-[#cbad78]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#cbad78] ring-1 ring-[#cbad78]/30">
                  hoje
                </span>
              )}
            </h2>
            <span className={`text-xs ${enviadas === 0 ? "text-amber-400" : "text-slate-500"}`}>
              {enviadas} de {SLOTS.length} mensagens enviadas
            </span>
          </div>
          {enviadas === 0 && (
            <p className="border-b border-slate-800/60 bg-amber-500/[0.06] px-5 py-3 text-xs text-amber-400/90">
              ⚠ Nenhuma mensagem saiu para esta aula
              {isToday ? " até agora" : ""} — o CRM não registrou nenhum disparo neste dia.
            </p>
          )}
          <div className="divide-y divide-slate-800/50">
            {SLOTS.map((sl) => {
              const list = s.slots[sl.type];
              const total = list.reduce((n, d) => n + d.total, 0);
              const success = list.reduce((n, d) => n + d.success, 0);
              const failed = list.reduce((n, d) => n + d.failed, 0);
              const skipped = list.reduce((n, d) => n + d.skipped, 0);
              const sent = list.length > 0;
              const firstAt = sent
                ? list.reduce((m, d) => (d.firstAt < m ? d.firstAt : m), list[0].firstAt)
                : null;
              const lastAt = sent
                ? list.reduce((m, d) => (d.lastAt > m ? d.lastAt : m), list[0].lastAt)
                : null;
              const sub = sent
                ? `${[...new Set(list.map((d) => fmtDay(d.day)))].join(" + ")} · ${fmtHour(firstAt!)}${
                    fmtHour(lastAt!) !== fmtHour(firstAt!) ? `–${fmtHour(lastAt!)}` : ""
                  }`
                : sl.hint;

              const row = (
                <>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#cbad78]/10 text-lg ring-1 ring-[#cbad78]/20">
                    {sl.emoji}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className={`block truncate text-sm font-semibold ${sent ? "text-white" : "text-slate-500"}`}>
                      {sl.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{sub}</span>
                  </span>
                  {sent ? (
                    <>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
                          ✓ {success}
                        </span>
                        {failed > 0 && (
                          <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-400 ring-1 ring-red-500/20">
                            ✕ {failed}
                          </span>
                        )}
                        {skipped > 0 && (
                          <span className="rounded-full bg-slate-700/40 px-2.5 py-1 text-[11px] font-bold text-slate-400">
                            ⏭ {skipped}
                          </span>
                        )}
                      </span>
                      <span className="w-16 shrink-0 text-right text-[11px] text-slate-600">
                        {total} lead{total === 1 ? "" : "s"}
                      </span>
                      <span className="shrink-0 text-slate-600 transition group-hover:text-[#cbad78]">
                        →
                      </span>
                    </>
                  ) : (
                    <span className="shrink-0 rounded-full border border-slate-800 px-3 py-1 text-[11px] text-slate-600">
                      ainda não enviada
                    </span>
                  )}
                </>
              );

              return sent ? (
                <button
                  key={sl.type}
                  onClick={() =>
                    setOpen({
                      label: `${sl.emoji} ${sl.label}`,
                      sub: `Webinar de ${weekdayName(s.day)} · ${fmtDay(s.day)} · ${total} destinatária${total === 1 ? "" : "s"}`,
                      disparos: list,
                    })
                  }
                  className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-slate-800/30"
                >
                  {row}
                </button>
              ) : (
                <div key={sl.type} className="flex w-full items-center gap-4 px-5 py-3.5 opacity-70">
                  {row}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}

      {outras.length > 0 && (
        <div className={card}>
          <div className="border-b border-slate-800/60 px-5 py-4">
            <h2 className="text-base font-bold text-white">💬 Outras mensagens</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Respostas ao convite, sequência pós-aula e demais envios.
            </p>
          </div>
          <div className="divide-y divide-slate-800/50">
            {outras.map((d) => (
              <button
                key={d.key}
                onClick={() =>
                  setOpen({
                    label: d.label,
                    sub: `${d.flowName} · ${fmtDay(d.day)} · ${d.total} destinatária${d.total === 1 ? "" : "s"}`,
                    disparos: [d],
                  })
                }
                className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-slate-800/30"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800/60 text-slate-400">
                  <Icon name="send" size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{d.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {d.flowName} · {fmtDay(d.day)} · {fmtHour(d.firstAt)}
                    {fmtHour(d.lastAt) !== fmtHour(d.firstAt) ? `–${fmtHour(d.lastAt)}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/20">
                    ✓ {d.success}
                  </span>
                  {d.failed > 0 && (
                    <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-400 ring-1 ring-red-500/20">
                      ✕ {d.failed}
                    </span>
                  )}
                </span>
                <span className="w-16 shrink-0 text-right text-[11px] text-slate-600">
                  {d.total} lead{d.total === 1 ? "" : "s"}
                </span>
                <span className="shrink-0 text-slate-600 transition group-hover:text-[#cbad78]">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && <RecipientsDialog {...open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ─── Modal: quem recebeu ────────────────────────────────────────────────────

type Bucket = "all" | "sent_only" | "delivered" | "read" | "failed" | "skipped";

function bucketOf(r: DisparoRecipient): Bucket {
  if (r.status === "skipped") return "skipped";
  if (r.status === "failed" || r.deliveryStatus === "failed") return "failed";
  if (r.deliveryStatus === "read") return "read";
  if (r.deliveryStatus === "delivered") return "delivered";
  return "sent_only";
}

function StatusPill({ r }: { r: DisparoRecipient }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold";
  if (r.status === "skipped")
    return <span className={`${base} bg-slate-700/40 text-slate-400`}>⏭ Pulado</span>;
  if (r.status === "failed")
    return <span className={`${base} bg-red-500/10 text-red-400 ring-1 ring-red-500/20`}>✕ Falhou</span>;
  if (r.deliveryStatus === "failed")
    return (
      <span className={`${base} bg-red-500/10 text-red-400 ring-1 ring-red-500/20`}>
        ⚠ Bloqueado pelo Meta
      </span>
    );
  if (r.deliveryStatus === "read")
    return <span className={`${base} bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20`}>👁 Lida</span>;
  if (r.deliveryStatus === "delivered")
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20`}>
        ✓✓ Entregue
      </span>
    );
  return <span className={`${base} bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20`}>✓ Enviada</span>;
}

function RecipientsDialog({
  label,
  sub,
  disparos,
  onClose,
}: {
  label: string;
  sub: string;
  disparos: Disparo[];
  onClose: () => void;
}) {
  const [recipients, setRecipients] = useState<DisparoRecipient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Bucket>("all");
  const [search, setSearch] = useState("");
  const keys = disparos.map((d) => d.key).join(",");

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      disparos.map((d) => getDisparoRecipients(d.flowId, d.stepId, d.day))
    ).then((results) => {
      if (cancelled) return;
      const err = results.find((r) => !r.success);
      if (err && !err.success) {
        setError(err.error);
        return;
      }
      const all = results.flatMap((r) => (r.success ? r.data : []));
      all.sort((a, b) => (a.leadName ?? "").localeCompare(b.leadName ?? "", "pt-BR"));
      setRecipients(all);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  const counts: Record<Exclude<Bucket, "all">, number> = {
    sent_only: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    skipped: 0,
  };
  for (const r of recipients ?? []) counts[bucketOf(r) as Exclude<Bucket, "all">]++;

  const filtered = (recipients ?? []).filter((r) => {
    if (filter !== "all" && bucketOf(r) !== filter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!(r.leadName ?? "").toLowerCase().includes(s) && !(r.leadPhone ?? "").includes(s))
        return false;
    }
    return true;
  });

  const tile = (key: Exclude<Bucket, "all">, title: string, valueClass: string) => (
    <button
      onClick={() => setFilter(filter === key ? "all" : key)}
      className={`rounded-xl border px-3 py-2 text-left transition ${
        filter === key
          ? "border-[#cbad78]/60 bg-[#cbad78]/10"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
      }`}
    >
      <p className="text-[11px] text-slate-500">{title}</p>
      <p className={`text-lg font-bold tabular-nums ${valueClass}`}>{counts[key]}</p>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-[#0b1120] shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/70 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">{label}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {error ? (
          <p className="px-6 py-12 text-center text-sm text-red-400">{error}</p>
        ) : recipients === null ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">Carregando…</p>
        ) : (
          <>
            <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-800/70 px-6 py-4 sm:grid-cols-5">
              {tile("sent_only", "Enviadas", "text-amber-400")}
              {tile("delivered", "Entregues", "text-emerald-400")}
              {tile("read", "Lidas", "text-sky-400")}
              {tile("failed", "Falharam", "text-red-400")}
              {tile("skipped", "Puladas", "text-slate-400")}
            </div>

            <div className="flex shrink-0 items-center gap-3 border-b border-slate-800/70 px-6 py-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou telefone…"
                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#cbad78]/40"
              />
              {filter !== "all" && (
                <button
                  onClick={() => setFilter("all")}
                  className="shrink-0 text-xs text-[#cbad78] hover:text-[#e3cfa0]"
                >
                  limpar filtro
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                  {search || filter !== "all" ? "Ninguém com esse filtro." : "Sem destinatárias."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-800/50">
                  {filtered.map((r) => (
                    <li key={r.executionId} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#cbad78]/10 text-xs font-bold text-[#cbad78]">
                        {(r.leadName ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {r.leadName ?? "Lead sem nome"}
                        </p>
                        <p className="text-xs text-slate-500">{r.leadPhone ?? "(sem telefone)"}</p>
                        {r.errorMessage && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-red-400/90">
                            {r.errorMessage}
                          </p>
                        )}
                        {r.deliveryError && (
                          <p
                            className="mt-0.5 line-clamp-2 text-[11px] text-red-400/70"
                            title={r.deliveryError}
                          >
                            {explainMetaError(r.deliveryError)}
                          </p>
                        )}
                      </div>
                      <StatusPill r={r} />
                      <span className="w-12 shrink-0 text-right text-[11px] text-slate-600">
                        {fmtHour(r.executedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-slate-800/70 px-6 py-3 text-xs text-slate-600">
              <span>
                Mostrando {filtered.length} de {recipients.length}
              </span>
              <span>Entregue/Lida vem da confirmação do WhatsApp</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
