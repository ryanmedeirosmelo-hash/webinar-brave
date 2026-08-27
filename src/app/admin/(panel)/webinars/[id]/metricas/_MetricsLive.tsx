"use client";

import { useEffect, useState } from "react";
import { getWebinarMetrics, type WebinarMetrics } from "@/app/admin/actions";
import { card } from "../_steps";

function pct(part: number, whole: number) {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

function fmtPos(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m${String(s).padStart(2, "0")}`;
}

function fmtSession(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MetricsLive({
  webinarId,
  initial,
}: {
  webinarId: string;
  initial: WebinarMetrics;
}) {
  const [m, setM] = useState<WebinarMetrics>(initial);

  useEffect(() => {
    let alive = true;
    const poll = () => {
      getWebinarMetrics(webinarId)
        .then((next) => {
          if (alive) setM(next);
        })
        .catch(() => {});
    };
    const id = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [webinarId]);

  const attendance = pct(m.entered, m.registered);
  const endRate = pct(m.reachedEnd, m.entered);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          Live exibida:{" "}
          <span className="font-semibold text-slate-200">{fmtSession(m.sessionStart)}</span>
          {m.sessionStart && <span className="text-slate-500"> (horário de Brasília)</span>}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Assistindo agora — destaque */}
        <div className={`${card} relative overflow-hidden`}>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            Assistindo agora
          </div>
          <p className="mt-2 text-4xl font-bold tabular-nums text-white">{m.watchingNow}</p>
          <p className="mt-1 text-xs text-slate-500">Vistos nos últimos 60 segundos</p>
        </div>

        {/* Entraram na live */}
        <div className={card}>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            ▶ Entraram na live
          </div>
          <p className="mt-2 text-4xl font-bold tabular-nums text-white">{m.entered}</p>
          <p className="mt-1 text-xs text-slate-500">Abriram a sala nesta live</p>
        </div>

        {/* Assistiram até o final */}
        <div className={card}>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            🏁 Assistiram até o final
          </div>
          <p className="mt-2 text-4xl font-bold tabular-nums text-white">
            {m.reachedEnd}
            {endRate !== null && (
              <span className="ml-2 text-base font-semibold text-emerald-400">{endRate}%</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">Chegaram aos minutos finais (de quem entrou)</p>
        </div>

        {/* Inscritos */}
        <div className={card}>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            📝 Inscritos
          </div>
          <p className="mt-2 text-4xl font-bold tabular-nums text-white">
            {m.registered}
            {attendance !== null && (
              <span className="ml-2 text-base font-semibold text-[#cbad78]">{attendance}%</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">Total cadastrado · taxa de comparecimento</p>
        </div>
      </div>

      {/* Quem está assistindo agora — local + aparelho */}
      {m.viewers.length > 0 && (
        <div className={card}>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            Quem está assistindo agora ({m.viewers.length})
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Local</th>
                  <th className="px-3 py-2 font-medium">Aparelho</th>
                  <th className="px-3 py-2 text-right font-medium">Na sala</th>
                  <th className="px-3 py-2 text-right font-medium">Ponto</th>
                </tr>
              </thead>
              <tbody>
                {m.viewers.map((v, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="px-3 py-2 tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 text-slate-200">{v.location ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {[v.device, v.os, v.browser].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                      {v.minutesInRoom} min
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                      {fmtPos(v.positionSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Local por IP (aproximado) · sem inscrição não há nome/e-mail.
          </p>
        </div>
      )}

      {/* Histórico por live (cada dia/horário separado) */}
      {m.sessions.length > 1 && (
        <div className={card}>
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            📅 Por live (cada dia separado)
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Live</th>
                  <th className="px-3 py-2 text-right font-medium">Entraram</th>
                  <th className="px-3 py-2 text-right font-medium">Até o fim</th>
                </tr>
              </thead>
              <tbody>
                {m.sessions.map((s, i) => {
                  const rate = pct(s.reachedEnd, s.entered);
                  return (
                    <tr
                      key={s.sessionStart}
                      className={`border-t border-slate-800 ${i === 0 ? "bg-slate-800/30" : ""}`}
                    >
                      <td className="px-3 py-2 text-slate-200">
                        {fmtSession(s.sessionStart)}
                        {i === 0 && (
                          <span className="ml-2 text-xs text-emerald-400">atual</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-white">{s.entered}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                        {s.reachedEnd}
                        {rate !== null && <span className="ml-1 text-xs text-slate-500">({rate}%)</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Atualiza automaticamente a cada 10 segundos. Cada live (dia/horário) conta separada.
      </p>
    </div>
  );
}
