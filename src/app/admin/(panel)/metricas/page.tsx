import { getAllLives } from "@/app/admin/actions";
import { MetricsReport } from "./_MetricsReport";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
  const lives = await getAllLives();
  return (
    // Layout "app": a página não rola — lista e detalhe têm scroll próprio.
    <div className="flex flex-col gap-5 p-8 pb-5 lg:h-dvh">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-white tracking-tight">Métricas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cada live realizada (dia/horário) com seus números reais.
        </p>
      </div>
      <MetricsReport lives={lives} />
    </div>
  );
}
