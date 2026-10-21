import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { publicLeadOrigin } from "@/lib/public-links";
import { PublicLinkActions } from "@/components/PublicLinkActions";
import type { ABTest } from "@/lib/ab-tests";
import { TestForm, type WebinarOption } from "./_TestForm";

export const dynamic = "force-dynamic";
type Count = { test_id: string; webinar_id: string; visitors: number };

export default async function ABTestsPage() {
  const db = supabaseAdmin();
  const [webinarsResult, testsResult, countsResult] = await Promise.all([
    db.from("webinars").select("id,title,internal_name,status").order("created_at", { ascending: false }),
    db.from("webinar_ab_tests").select("*").order("created_at", { ascending: false }),
    db.rpc("webinar_ab_counts"),
  ]);
  const webinars = (webinarsResult.data ?? []) as WebinarOption[];
  const tests = (testsResult.data ?? []) as ABTest[];
  const counts = (countsResult.data ?? []) as Count[];
  const unavailable = testsResult.error || countsResult.error || webinarsResult.error;
  return (
    <div className="mx-auto max-w-5xl p-5 md:p-8">
      <h1 className="text-2xl font-bold text-white">Testes A/B</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">Compartilhe um único link e escolha a porcentagem de visitantes destinada a cada webinar.</p>
      {unavailable ? <div role="alert" className="mt-7 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200">Não foi possível carregar o módulo. Verifique a conexão e se a migração webinar_ab_tests foi aplicada ao banco.</div> : <>
        <section className="mt-7 rounded-xl border border-slate-800 bg-slate-900/50 p-5 md:p-6">
          <h2 className="mb-5 text-lg font-semibold text-white">Novo teste</h2>
          {webinars.filter(w => w.status === "active").length < 2 ? <p className="text-sm text-amber-200">Publique pelo menos dois webinars para criar um teste. <Link href="/admin" className="underline">Ver webinars</Link></p> : <TestForm webinars={webinars.filter(w => w.status === "active")} />}
        </section>
        <h2 className="mb-4 mt-9 text-lg font-semibold text-white">Seus testes</h2>
        {!tests.length && <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">Crie o primeiro teste acima para gerar seu link de distribuição.</p>}
        <div className="space-y-5">{tests.map(test => {
          const testCounts = counts.filter(c => c.test_id === test.id);
          const total = testCounts.reduce((sum, c) => sum + Number(c.visitors), 0);
          return <article key={test.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-white">{test.name}</h3><span className={`rounded-full px-3 py-1 text-xs ${test.active ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>{test.active ? "Em andamento" : "Pausado"}</span></div>
            <PublicLinkActions path={`/ab/${test.id}`} origin={publicLeadOrigin()} pageName="teste" />
            <p className="mt-4 text-sm text-slate-300">{total.toLocaleString("pt-BR")} visitantes distribuídos</p>
            <div className="my-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Webinar</th><th className="px-3">Meta</th><th className="px-3">Visitantes</th><th className="px-3">Real</th></tr></thead><tbody>{Array.from(new Set([...test.variants.map(v => v.webinar_id), ...testCounts.map(c => c.webinar_id)])).map(id => {
              const variant = test.variants.find(v => v.webinar_id === id);
              const count = Number(testCounts.find(c => c.webinar_id === id)?.visitors ?? 0);
              const webinar = webinars.find(w => w.id === id);
              return <tr key={id} className="border-t border-slate-800 text-slate-300"><td className="py-3">{webinar?.internal_name || webinar?.title || "Webinar indisponível"}{!variant && " (removido do teste)"}</td><td className="px-3">{variant?.weight ?? 0}%</td><td className="px-3">{count.toLocaleString("pt-BR")}</td><td className="px-3">{total ? (count / total * 100).toFixed(1) : "0"}%</td></tr>;
            })}</tbody></table></div>
            <p className="mb-4 text-xs text-slate-500">Contagem por navegador, sem inscrições ou vendas atribuídas. Acessos diretos aos webinars não entram no teste. Atualize a página para ver novas contagens.</p>
            <details className="border-t border-slate-800 pt-4"><summary className="cursor-pointer text-sm text-[#cbad78]">Editar divisão e status</summary><div className="mt-5"><TestForm webinars={webinars} test={test} /></div></details>
          </article>;
        })}</div>
      </>}
    </div>
  );
}
