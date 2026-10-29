"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getLiveDashboard } from "./actions";
import { startVisiblePolling } from "@/lib/visible-polling";
import { metricRate, observedTime, type LiveDashboardData } from "@/lib/live-metrics";
import { ADMIN_TIMEZONE } from "@/lib/brand";

const panel = "rounded-xl border border-slate-800 bg-slate-900/50 p-5";
const number = (n: number) => n.toLocaleString("pt-BR");
function timestamp(iso: string) { return new Date(iso).toLocaleString("pt-BR", { timeZone: ADMIN_TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

export function LiveDashboard({ initial, mode }: { initial: LiveDashboardData; mode: "live" | "comparison" }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      const next = await getLiveDashboard(initial.kind, initial.id);
      if (!next) throw new Error("Este acompanhamento não está mais disponível.");
      if (mounted.current) { setData(next); setError(""); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Não foi possível atualizar."); }
    finally { running.current = false; if (mounted.current) setPending(false); }
  }, [initial.kind, initial.id]);
  useEffect(() => {
    mounted.current = true;
    const stop = startVisiblePolling(refresh, 10_000);
    return () => { mounted.current = false; stop(); };
  }, [refresh]);
  const test = data.kind === "test";
  const sum = (key: "watching_now" | "entered" | "registered" | "offer_clicks" | "reached_end") => data.variants.reduce((n, v) => n + v[key], 0);
  const watching = sum("watching_now"), entered = sum("entered"), registered = sum("registered"), clicks = sum("offer_clicks");
  const assigned = data.variants.reduce((n, v) => n + (v.assigned ?? 0), 0);
  const locations = new Map<string, number>();
  for (const variant of data.variants) for (const place of variant.locations) locations.set(place.label, (locations.get(place.label) ?? 0) + place.count);
  const orderedLocations = [...locations].sort((a, b) => b[1] - a[1]);
  const average = entered ? data.variants.reduce((n, v) => n + v.average_seconds * v.entered, 0) / entered : 0;
  return <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link href={test ? "/admin/testes-ab" : "/admin/ao-vivo"} className="text-sm text-slate-400 hover:text-white">← {test ? "Testes A/B" : "Webinars ao vivo"}</Link><p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-[#cbad78]">{mode === "comparison" ? "Comparação A/B" : "Audiência em tempo real"}</p><h1 className="text-2xl font-bold text-white">{data.title}</h1></div>
      <button type="button" disabled={pending} onClick={refresh} className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm text-white hover:border-[#cbad78] disabled:opacity-50">{pending ? "Atualizando…" : "Atualizar agora"}</button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400"><p role="status" aria-live="polite">{error ? "Atualização interrompida · exibindo os últimos dados disponíveis" : `Atualizado em ${timestamp(data.updated_at)}`}</p><p>A cada 10 segundos com a aba visível · presença nos últimos 60 segundos</p></div>
    {error && <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{error} A atualização será tentada novamente automaticamente.</p>}
    {test ? <>
      <nav aria-label="Visões do teste" className="flex flex-wrap gap-2"><Link aria-current={mode === "comparison" ? "page" : undefined} href={`/admin/testes-ab/${data.id}/metricas`} className={`min-h-11 rounded-lg border px-4 py-3 text-sm ${mode === "comparison" ? "border-[#cbad78] text-[#cbad78]" : "border-slate-700 text-slate-300"}`}>Comparar variantes</Link><Link aria-current={mode === "live" ? "page" : undefined} href={`/admin/testes-ab/${data.id}/ao-vivo`} className={`min-h-11 rounded-lg border px-4 py-3 text-sm ${mode === "live" ? "border-[#cbad78] text-[#cbad78]" : "border-slate-700 text-slate-300"}`}>Ver audiência ao vivo</Link></nav>
      <p className="text-sm leading-6 text-slate-400">Somente participantes vinculados a este teste. A coleta de inscrições, audiência e cliques começou em {data.metrics_started_at ? timestamp(data.metrics_started_at) : "—"}; os distribuídos incluem o histórico, enquanto as taxas usam apenas a base acompanhada desde o início da coleta. Participantes antigos passam a ser vinculados ao retornar pelo link do teste.</p>
    </> : <p className="text-sm text-slate-400">Os indicadores acumulam o histórico deste webinar. As pessoas e localidades abaixo mostram somente a audiência presente agora. <Link href={`/admin/webinars/${data.id}/metricas`} className="text-[#cbad78] underline">Ver métricas por transmissão</Link></p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Assistindo agora", number(watching), "Presença recente, sem somar audiências simuladas"],
      [test ? "Participantes que assistiram" : "Pessoas que assistiram", number(entered), "Identidades distintas no histórico observado"],
      ["Inscritos", number(registered), test ? "Participantes do teste com inscrição" : "Inscrições acumuladas do webinar"],
      ["Clicaram na oferta", number(clicks), "Pessoas distintas que clicaram"],
    ].map(([label, value, hint], i) => <section key={label} className={`${panel} ${i === 0 ? "border-emerald-500/40" : ""}`}><h2 className="text-sm text-slate-400">{label}</h2><p className={`mt-3 text-4xl font-semibold tabular-nums ${i === 0 ? "text-emerald-300" : "text-white"}`}>{value}</p><p className="mt-3 text-xs leading-5 text-slate-400">{hint}</p></section>)}</div>
    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-300">{test && <p>Distribuídos: <strong>{number(assigned)}</strong></p>}<p>Chegaram a 90% do vídeo: <strong>{number(sum("reached_end"))} ({metricRate(sum("reached_end"), entered)})</strong></p><p>Tempo médio observado: <strong>{observedTime(average)}</strong> <span className="text-slate-500">(estimado por minutos registrados)</span></p></div>
    {test && <section className={panel}><h2 className="text-lg font-semibold text-white">Comparação das variantes</h2><p className="mt-1 text-xs leading-5 text-slate-400">Compare as taxas junto com o tamanho de cada amostra. Estes números não indicam significância estatística nem atribuem compras ao teste.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="text-xs text-slate-400"><tr>{["Webinar", "Meta / real", "Distribuídos", "Base acompanhada", "Inscritos / taxa", "Assistiram / taxa", "Agora", "Cliques / taxa", "Chegaram a 90%", "Tempo médio"].map(label => <th scope="col" key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{data.variants.map(v => <tr key={v.webinar_id} className="border-t border-slate-800 text-slate-300"><th scope="row" className="px-3 py-4 font-medium text-white"><Link href={`/admin/ao-vivo/${v.webinar_id}`} className="hover:underline">{v.title || "Webinar indisponível"}</Link>{v.removed && <span className="block text-xs font-normal text-slate-400">Removida da distribuição</span>}</th><td className="px-3">{v.weight}% / {metricRate(v.assigned ?? 0, assigned)}</td><td className="px-3">{number(v.assigned ?? 0)}</td><td className="px-3">{number(v.tracked_assigned ?? 0)}</td><td className="px-3">{number(v.registered)} / {metricRate(v.registered, v.tracked_assigned ?? 0)}</td><td className="px-3">{number(v.entered)} / {metricRate(v.entered, v.tracked_assigned ?? 0)}</td><td className="px-3 font-semibold text-emerald-300">{number(v.watching_now)}</td><td className="px-3">{number(v.offer_clicks)} / {metricRate(v.offer_clicks, v.entered)}</td><td className="px-3">{number(v.reached_end)} / {metricRate(v.reached_end, v.entered)}</td><td className="px-3">{observedTime(v.average_seconds)}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-slate-400">Inscrição e audiência: taxa sobre a base acompanhada. Clique e 90%: taxa sobre quem assistiu. “—” indica ausência de amostra.</p></section>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section className={panel}><h2 className="text-lg font-semibold text-white">De onde estão assistindo</h2><p className="mt-1 text-xs leading-5 text-slate-400">Localização aproximada pela conexão; não é GPS. VPNs e redes móveis podem alterar o local informado.</p><div className="mt-5 max-h-[36rem] space-y-4 overflow-y-auto">{orderedLocations.map(([label, count]) => <div key={label}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="text-slate-300">{label}</span><span className="shrink-0 tabular-nums text-white">{number(count)} · {metricRate(count, watching)}</span></div><div className="h-1.5 rounded-full bg-slate-800" aria-hidden="true"><div className="h-full rounded-full bg-[#cbad78]" style={{ width: `${watching ? count / watching * 100 : 0}%` }} /></div></div>)}{!orderedLocations.length && <p className="py-5 text-sm text-slate-400">Sem espectadores presentes agora.</p>}</div></section>
      <div className="min-w-0 space-y-5">{data.variants.map(v => <section key={v.webinar_id} className={panel}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-white">{test ? v.title || "Variante" : "Pessoas assistindo agora"}</h2><span className="text-sm font-medium text-emerald-300">{number(v.watching_now)} ao vivo</span></div>{v.watching_now > v.attendees.length && <p className="mt-2 text-xs text-slate-400">Exibindo as {v.attendees.length} presenças mais recentes de {number(v.watching_now)}. O total e as localidades incluem todas.</p>}<div className="mt-4 max-h-[36rem] overflow-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-xs text-slate-400"><tr>{["Pessoa", "Localidade", "Dispositivo", "Posição", "Tempo observado"].map(label => <th key={label} scope="col" className="px-2 py-3">{label}</th>)}</tr></thead><tbody>{v.attendees.map(person => <tr key={person.id} className="border-t border-slate-800 text-slate-300"><td className="px-2 py-3">{person.name}</td><td className="px-2">{person.location}</td><td className="px-2">{person.device || "Não informado"}</td><td className="px-2 tabular-nums">{observedTime(person.position_seconds)}</td><td className="px-2 tabular-nums">{observedTime(person.observed_seconds)}</td></tr>)}</tbody></table></div>{!v.attendees.length && <p className="py-5 text-sm text-slate-400">Ninguém presente nesta variante agora.</p>}</section>)}</div>
    </div>
  </div>;
}
