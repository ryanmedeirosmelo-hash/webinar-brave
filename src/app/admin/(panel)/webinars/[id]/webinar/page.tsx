import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { updateWebinar } from "@/app/admin/actions";
import { input, label, card, saveBtn } from "../_steps";
import { TypeTabs, Toggle } from "../_fields";
import { dateTimeLocalValue } from "@/lib/time";
import type { Webinar } from "@/types/db";

export const dynamic = "force-dynamic";

function dtLocal(iso: string | null, timezone: string) {
  return dateTimeLocalValue(iso, timezone);
}

export default async function StepWebinar({
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

  return (
    <form action={updateWebinar} className="max-w-4xl space-y-5">
      <input type="hidden" name="id" value={w.id} />
      <input type="hidden" name="recurrence_present" value="1" />
      <input type="hidden" name="waiting_present" value="1" />
      <input type="hidden" name="__redirect" value={`/admin/webinars/${w.id}/login`} />

      <TypeTabs defaultValue={w.type} />

      <div className={card}>
        <h2 className="font-semibold text-white mb-1">Datas e horários</h2>
        <p className="text-sm text-slate-400 mb-5">
          Webinar único acontece num dia/horário específico. Just in time se repete em
          intervalos curtos.
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>Data e hora de início *</label>
            <input type="datetime-local" name="start_at" defaultValue={dtLocal(w.start_at, w.timezone)} className={input} />
          </div>
          <div>
            <label className={label}>Data e hora de finalização *</label>
            <input type="datetime-local" name="end_at" defaultValue={dtLocal(w.end_at, w.timezone)} className={input} />
          </div>
          <div>
            <label className={label}>Fuso horário *</label>
            <select name="timezone" defaultValue={w.timezone} className={input}>
              <option value="America/Sao_Paulo">(GMT-03:00) Horário de Brasília</option>
              <option value="America/Manaus">(GMT-04:00) Manaus</option>
              <option value="America/Rio_Branco">(GMT-05:00) Rio Branco</option>
            </select>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-800 pt-5">
          <Toggle name="recurrence_enabled" defaultChecked={w.recurrence_enabled} label="Repetir webinar diariamente ou semanalmente" />
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className={label}>Escolha quando</label>
              <select name="recurrence_freq" defaultValue={w.recurrence_freq} className={input}>
                <option value="weekly">Semanal</option>
                <option value="daily">Diário</option>
              </select>
            </div>
            <div>
              <label className={label}>Dias da semana</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {([
                  [1, "Seg"],
                  [2, "Ter"],
                  [3, "Qua"],
                  [4, "Qui"],
                  [5, "Sex"],
                  [6, "Sáb"],
                  [7, "Dom"],
                ] as const).map(([d, lbl]) => (
                  <label
                    key={d}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      name={`recurrence_day_${d}`}
                      defaultChecked={(w.recurrence_days ?? []).includes(d)}
                      className="accent-emerald-500"
                    />
                    <span className="text-sm text-slate-200">{lbl}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Use os horários do bloco abaixo (ex.: 19:15). A sala abre sozinha só nesses dias.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-800 pt-5">
          <Toggle name="waiting_room_enabled" defaultChecked={w.waiting_room_enabled} label="Usar sala de espera antes do início" />
          <div className="mt-4 max-w-md">
            <label className={label}>Página de espera</label>
            <select name="waiting_room_page" defaultValue={w.waiting_room_page} className={input}>
              <option value="default">Layout padrão (com formulário de inscrição)</option>
              <option value="landing">O próprio link é a sala de espera (sem formulário)</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Com a 2ª opção, abrir o link do webinar mostra direto a contagem
              regressiva e, no horário, toca o vídeo na mesma página — sem inscrição.
            </p>
          </div>
        </div>
      </div>

      {/* só visível na lógica JIT, mas mantemos editável */}
      <div className={card}>
        <h2 className="font-semibold text-white mb-4">Just in time</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Intervalo (min) — começa a cada X minutos</label>
            <input name="jit_interval_minutes" type="number" defaultValue={w.jit_interval_minutes} className={input} />
          </div>
          <div>
            <label className={label}>Horários disponíveis (vírgula)</label>
            <input name="available_times" defaultValue={w.available_times.join(", ")} className={input} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className={saveBtn}>Continuar ›</button>
      </div>
    </form>
  );
}
