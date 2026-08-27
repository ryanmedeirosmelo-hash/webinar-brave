import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { updateWebinar } from "@/app/admin/actions";
import { ImageUploader } from "@/components/ImageUploader";
import { input, label, card, saveBtn } from "../_steps";
import { Toggle, ColorField } from "../_fields";
import type { Webinar, FormField } from "@/types/db";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<FormField["key"], string> = {
  name: "Nome",
  email: "E-mail",
  whatsapp: "WhatsApp",
};

export default async function StepLogin({
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

  const fields = w.form_fields ?? [];
  const fieldOf = (k: FormField["key"]) => fields.find((f) => f.key === k);

  return (
    <form action={updateWebinar} className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <input type="hidden" name="id" value={w.id} />
      <input type="hidden" name="login_present" value="1" />
      <input type="hidden" name="__redirect" value={`/admin/webinars/${w.id}/video`} />

      <div className="space-y-5">
        {/* Logo */}
        <div className={card}>
          <ImageUploader
            name="logo_url"
            webinarId={w.id}
            defaultUrl={w.logo_url}
            label="Logo do webinar (≈ 220×60)"
          />
        </div>

        {/* Barra de progresso */}
        <div className={card}>
          <h2 className="font-semibold text-white mb-4">Barra de progresso</h2>
          <div className="flex flex-wrap items-center gap-5">
            <Toggle name="progress_bar_enabled" defaultChecked={w.progress_bar_enabled} label="Exibir barra de progresso" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Iniciar em</span>
              <input name="progress_start" type="number" min={0} max={100} defaultValue={w.progress_start} className={`${input} w-20`} />
              <span className="text-xs text-slate-500">%</span>
            </div>
            <ColorField name="progress_bar_color" defaultValue={w.progress_bar_color} label="Cor da barra" />
            <ColorField name="progress_text_color" defaultValue={w.progress_text_color} label="Cor do texto" />
          </div>
        </div>

        {/* Título da página */}
        <div className={card}>
          <label className={label}>Título do Webinar * (até 150 caracteres)</label>
          <textarea
            name="capture_title"
            defaultValue={w.capture_title ?? ""}
            rows={2}
            maxLength={150}
            placeholder="[🔴 AO VIVO] Como acelerar os seus resultados…"
            className={input}
          />
        </div>

        {/* Botão */}
        <div className={card}>
          <h2 className="font-semibold text-white mb-4">Editar botão</h2>
          <label className={label}>Título do botão * (até 40 caracteres)</label>
          <input name="capture_button_label" maxLength={40} defaultValue={w.capture_button_label} className={input} />
          <div className="flex items-center gap-5 mt-3">
            <ColorField name="capture_button_color" defaultValue={w.capture_button_color} label="Cor do botão" />
            <ColorField name="capture_button_text_color" defaultValue={w.capture_button_text_color} label="Cor do texto" />
          </div>
        </div>

        {/* Formulário de acesso */}
        <div className={card}>
          <h2 className="font-semibold text-white mb-4">Formulário de acesso à sala</h2>
          <div className="space-y-3">
            {(["name", "email", "whatsapp"] as const).map((k) => {
              const f = fieldOf(k);
              return (
                <div key={k} className="grid sm:grid-cols-[110px_1fr_auto_auto] gap-3 items-center border border-slate-800 rounded-lg p-3">
                  <span className="text-sm font-medium text-slate-300">{FIELD_LABELS[k]}</span>
                  <input
                    name={`field_${k}_label`}
                    defaultValue={f?.label ?? ""}
                    placeholder="Título do campo"
                    className={input}
                  />
                  <Toggle name={`field_${k}_enabled`} defaultChecked={f?.enabled ?? true} label="Exibir" />
                  <Toggle name={`field_${k}_required`} defaultChecked={f?.required ?? false} label="Obrigatório" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button className={saveBtn}>Continuar ›</button>
        </div>
      </div>

      {/* Prévia */}
      <aside className="lg:sticky lg:top-4">
        <p className="text-xs text-slate-500 mb-2">Prévia</p>
        <div className="rounded-xl bg-white text-slate-900 p-5 shadow-xl">
          {w.progress_bar_enabled && (
            <div className="mb-3 rounded-full h-6 grid place-items-center text-xs font-semibold text-white" style={{ background: w.progress_bar_color, color: w.progress_text_color }}>
              {w.progress_start}% das vagas preenchidas…
            </div>
          )}
          {w.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.logo_url} alt="" className="h-8 mb-3 object-contain" />
          )}
          <p className="font-bold text-lg leading-snug">
            {w.capture_title || "[🔴 AO VIVO] Título do seu webinar aqui"}
          </p>
          <div className="mt-4 space-y-2">
            {(["name", "email", "whatsapp"] as const)
              .filter((k) => fieldOf(k)?.enabled)
              .map((k) => (
                <input
                  key={k}
                  disabled
                  placeholder={fieldOf(k)?.label || FIELD_LABELS[k]}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50"
                />
              ))}
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-md px-4 py-2.5 text-sm font-bold"
            style={{ background: w.capture_button_color, color: w.capture_button_text_color }}
          >
            {w.capture_button_label} →
          </button>
        </div>
      </aside>
    </form>
  );
}
