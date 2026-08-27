import { getDisparos } from "@/app/admin/disparos";
import { DisparosReport } from "./_DisparosReport";
import { ADMIN_TIMEZONE } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function DisparosPage() {
  const result = await getDisparos();
  // Hoje no fuso de SP, calculado no servidor: o cliente usaria o relógio da
  // máquina de quem abre o painel e o card "hoje" hidrataria diferente.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: ADMIN_TIMEZONE });

  return (
    <div className="flex flex-col gap-5 p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-white tracking-tight">Disparos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cada mensagem de WhatsApp enviada para os inscritos — e quem recebeu, entregou e leu.
        </p>
      </div>
      {result.success ? (
        <DisparosReport disparos={result.data} today={today} />
      ) : (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-8 text-center">
          <p className="text-sm text-slate-400">Não consegui ler os disparos agora.</p>
          <p className="mt-1 text-xs text-slate-600">{result.error}</p>
        </div>
      )}
    </div>
  );
}
