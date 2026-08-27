import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  updateWebinar,
  addSalesNotification,
  deleteSalesNotification,
  importSalesCsv,
} from "@/app/admin/actions";
import { input, label, card, saveBtn } from "../_steps";
import type { Webinar, SalesNotification } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function StepVendas({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { data: w } = await supabase.from("webinars").select("*").eq("id", id).single<Webinar>();
  if (!w) notFound();

  const { data: sales } = await supabase
    .from("sales_notifications")
    .select("*")
    .eq("webinar_id", id)
    .order("at_seconds");
  const salesList = (sales ?? []) as SalesNotification[];

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <h2 className="font-semibold text-white">Configure suas vendas</h2>

        {/* Título da notificação */}
        <form action={updateWebinar} className={card}>
          <input type="hidden" name="id" value={w.id} />
          <label className={label}>Título da notificação de compra</label>
          <input
            name="sales_notification_title"
            defaultValue={w.sales_notification_title ?? ""}
            placeholder="Venda confirmada!"
            className={input}
          />
          <button className="mt-2 rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white">
            Salvar título
          </button>
        </form>

        {/* Via arquivo */}
        <details className={card} open>
          <summary className="cursor-pointer font-medium text-slate-200">Crie suas vendas via arquivo</summary>
          <form action={importSalesCsv} className="mt-3">
            <input type="hidden" name="webinar_id" value={id} />
            <label className={label}>Cole a planilha (tempo, nome, cidade, [texto])</label>
            <textarea
              name="csv"
              rows={5}
              placeholder={"38, Mariana A., São Paulo SP\n52, Rodrigo P., Belo Horizonte MG"}
              className={input}
            />
            <button className="mt-2 rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white">
              Importar vendas
            </button>
          </form>
        </details>

        {/* Individual */}
        <details className={card}>
          <summary className="cursor-pointer font-medium text-slate-200">Crie sua venda individual</summary>
          <form action={addSalesNotification} className="mt-3 flex flex-wrap gap-2 items-end">
            <input type="hidden" name="webinar_id" value={id} />
            <div className="w-24">
              <label className={label}>Seg.</label>
              <input name="at_seconds" type="number" defaultValue={0} className={input} />
            </div>
            <div className="w-40">
              <label className={label}>Comprador</label>
              <input name="buyer_name" placeholder="Mariana A." className={input} required />
            </div>
            <div className="w-36">
              <label className={label}>Cidade</label>
              <input name="buyer_city" placeholder="São Paulo, SP" className={input} />
            </div>
            <button className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white">+ Add</button>
          </form>
        </details>

        <div className="flex justify-end">
          <Link href={`/admin/webinars/${id}/audiencia`} className={saveBtn}>Continuar ›</Link>
        </div>
      </div>

      {/* Prévia */}
      <div className={card}>
        <h2 className="font-semibold text-white mb-3">Notificações ({salesList.length})</h2>
        <ul className="space-y-1.5 max-h-[460px] overflow-y-auto">
          {salesList.map((s) => (
            <li key={s.id} className="flex items-center gap-3 text-sm border-b border-slate-800/60 pb-1.5">
              <span className="w-12 shrink-0 tabular-nums text-[#cbad78]">{s.at_seconds}s</span>
              <span className="flex-1 text-slate-200 truncate">
                <b>{s.buyer_name}</b> {s.product_label}
                {s.buyer_city && <span className="text-slate-500"> · {s.buyer_city}</span>}
              </span>
              <form action={deleteSalesNotification}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="webinar_id" value={id} />
                <button className="text-red-400 hover:text-red-300">✕</button>
              </form>
            </li>
          ))}
          {salesList.length === 0 && <li className="text-sm text-slate-500">Nenhuma venda ainda.</li>}
        </ul>
      </div>
    </div>
  );
}
