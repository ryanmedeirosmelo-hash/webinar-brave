import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { updateWebinar } from "@/app/admin/actions";
import { input, label, card, saveBtn } from "../_steps";
import { Toggle } from "../_fields";
import type { Webinar } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function StepAudiencia({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: w } = await supabaseAdmin()
    .from("webinars")
    .select("*")
    .eq("id", id)
    .single<Webinar>();
  if (!w) notFound();

  const current = !w.audience_enabled ? "none" : w.audience_mode === "fixed" ? "fixed" : "dynamic";

  // curva decorativa da prévia (sobe, estabiliza, cai)
  const pts = [0.45, 0.85, 0.9, 0.9, 0.92, 0.78, 0.7, 0.6, 0.5];
  const w0 = 320, h0 = 120, pad = 8;
  const path = pts
    .map((p, i) => {
      const x = pad + (i / (pts.length - 1)) * (w0 - pad * 2);
      const y = h0 - pad - p * (h0 - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const radios: { v: string; label: string }[] = [
    { v: "none", label: "Não exibir audiência" },
    { v: "fixed", label: "Audiência fixa" },
    { v: "dynamic", label: "Audiência dinâmica" },
  ];

  return (
    <form action={updateWebinar} className="grid lg:grid-cols-2 gap-6 items-start">
      <input type="hidden" name="id" value={w.id} />
      <input type="hidden" name="audience_present" value="1" />
      <input type="hidden" name="__redirect" value={`/admin/webinars/${w.id}/integracoes`} />

      <div className={`${card} space-y-5`}>
        <div>
          <h2 className="font-semibold text-white mb-3">Escolha seu tipo de audiência</h2>
          <div className="space-y-2">
            {radios.map((r) => (
              <label key={r.v} className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                <input type="radio" name="audience_radio" value={r.v} defaultChecked={current === r.v} className="h-4 w-4" />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-800 pt-5">
          <h3 className="font-semibold text-white mb-3">Simule sua audiência</h3>
          <div className="space-y-3">
            <div>
              <label className={label}>Número mínimo de participantes *</label>
              <input name="audience_min" type="number" min={0} defaultValue={w.audience_min} className={input} />
            </div>
            <div>
              <label className={label}>Número máximo de participantes *</label>
              <input name="audience_max" type="number" min={0} defaultValue={w.audience_max} className={input} />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-5">
          <Toggle name="show_live_button" defaultChecked={w.show_live_button} label="Mostrar botão ao vivo" />
        </div>

        <div className="flex justify-end">
          <button className={saveBtn}>Continuar ›</button>
        </div>
      </div>

      {/* Prévia */}
      <aside className="lg:sticky lg:top-4">
        <p className="text-xs text-slate-500 mb-2">Prévia</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-xl bg-blue-600 p-4 text-white">
            <p className="text-xs opacity-80">Máximo de participantes</p>
            <p className="text-2xl font-bold">{w.audience_max}</p>
          </div>
          <div className="rounded-xl bg-rose-600 p-4 text-white">
            <p className="text-xs opacity-80">Mínimo de participantes</p>
            <p className="text-2xl font-bold">{w.audience_min}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <svg viewBox={`0 0 ${w0} ${h0}`} className="w-full">
            <path d={path} fill="none" stroke="#ef4444" strokeWidth="2.5" />
            {pts.map((p, i) => {
              const x = pad + (i / (pts.length - 1)) * (w0 - pad * 2);
              const y = h0 - pad - p * (h0 - pad * 2);
              return <circle key={i} cx={x} cy={y} r="3" fill="#ef4444" />;
            })}
          </svg>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>20:00</span><span>21:00</span><span>22:00</span><span>23:00</span>
          </div>
        </div>
      </aside>
    </form>
  );
}
