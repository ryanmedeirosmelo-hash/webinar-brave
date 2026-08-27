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

const FIELD_PLACEHOLDERS: Record<FormField["key"], string> = {
  name: "Seu nome completo",
  email: "Seu melhor e-mail",
  whatsapp: "Seu telefone",
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
  const scarcity = w.capture_scarcity_text?.trim() || "Não perca tempo, vagas acabando:";
  const progress = Math.min(100, Math.max(0, w.progress_start ?? 0));

  return (
    <form action={updateWebinar} className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      <input type="hidden" name="id" value={w.id} />
      <input type="hidden" name="login_present" value="1" />
      <input type="hidden" name="__redirect" value={`/admin/webinars/${w.id}/video`} />

      <div className="space-y-5">
        {/* Logo + imagem da página */}
        <div className={`${card} grid sm:grid-cols-2 gap-6`}>
          <ImageUploader
            name="logo_url"
            webinarId={w.id}
            defaultUrl={w.logo_url}
            label="Logo do webinar (≈ 220×60)"
          />
          <ImageUploader
            name="capture_image_url"
            webinarId={w.id}
            defaultUrl={w.capture_image_url}
            label="Imagem da página (ao lado do formulário)"
            hint="Formato retrato ou quadrado, ≈ 900×1000. Sem imagem, o formulário ocupa a largura toda."
          />
        </div>

        {/* Barra de progresso */}
        <div className={card}>
          <h2 className="font-semibold text-white mb-4">Faixa de escassez</h2>
          <div className="flex flex-wrap items-center gap-5">
            <Toggle name="progress_bar_enabled" defaultChecked={w.progress_bar_enabled} label="Exibir faixa" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Iniciar em</span>
              <input name="progress_start" type="number" min={0} max={100} defaultValue={w.progress_start} className={`${input} w-20`} />
              <span className="text-xs text-slate-500">%</span>
            </div>
            <ColorField name="progress_bar_color" defaultValue={w.progress_bar_color} label="Cor da barra" />
            <ColorField name="progress_text_color" defaultValue={w.progress_text_color} label="Cor do texto" />
          </div>
          <div className="mt-4">
            <label className={label}>Texto da faixa</label>
            <input
              name="capture_scarcity_text"
              maxLength={80}
              defaultValue={w.capture_scarcity_text ?? ""}
              placeholder="Não perca tempo, vagas acabando:"
              className={input}
            />
          </div>
        </div>

        {/* Textos da página */}
        <div className={card}>
          <label className={label}>Título do Webinar * (até 150 caracteres)</label>
          <textarea
            name="capture_title"
            defaultValue={w.capture_title ?? ""}
            rows={2}
            maxLength={150}
            placeholder="Seu corpo não precisa de mais um chazinho. Precisa de um passo a passo."
            className={input}
          />

          <label className={`${label} mt-4`}>Texto de apoio</label>
          <textarea
            name="description"
            defaultValue={w.description ?? ""}
            rows={4}
            placeholder="Falta de energia, queda de cabelo… **Às 20h, em uma aula 100% gratuita,** eu vou te mostrar…"
            className={input}
          />
          <p className="mt-1 text-xs text-slate-500">
            Use <code>**texto**</code> para deixar um trecho em negrito. Linhas em branco viram
            parágrafos.
          </p>
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

      {/* Prévia — espelha a página de captura (card branco sobre preto) */}
      <aside className="lg:sticky lg:top-4">
        <p className="text-xs text-slate-500 mb-2">Prévia</p>
        <div className="rounded-xl bg-black p-3">
          <div className="rounded-lg bg-white text-slate-900 p-4">
            {w.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.logo_url} alt="" className="h-6 mb-3 object-contain" />
            )}
            <p className="font-bold text-[15px] leading-snug">
              {w.capture_title || "Título do seu webinar aqui"}
            </p>
            {w.description && (
              <p className="mt-2 text-[12px] leading-relaxed text-slate-600 line-clamp-3">
                {w.description.replace(/\*\*/g, "")}
              </p>
            )}
            {w.capture_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.capture_image_url} alt="" className="mt-3 h-24 w-full rounded-md object-cover" />
            )}
            <p className="mt-3 text-[11px] font-bold">Escolha sua data</p>
            <div className="mt-1 rounded-md border-2 border-slate-900 px-2.5 py-1.5">
              <p className="text-[12px] font-bold">Hoje às 13h30</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">
                Começa em 3 minutos
              </p>
            </div>
            <div className="mt-2 space-y-1.5">
              {(["name", "email", "whatsapp"] as const)
                .filter((k) => fieldOf(k)?.enabled ?? true)
                .map((k) => (
                  <div key={k}>
                    <p className="text-[10px] font-bold">{fieldOf(k)?.label || FIELD_LABELS[k]}</p>
                    <input
                      disabled
                      placeholder={FIELD_PLACEHOLDERS[k]}
                      className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] bg-white"
                    />
                  </div>
                ))}
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-md px-4 py-2 text-[11px] font-extrabold uppercase"
              style={{ background: w.capture_button_color, color: w.capture_button_text_color }}
            >
              {w.capture_button_label}
            </button>
          </div>

          {w.progress_bar_enabled && (
            <div className="mt-2 rounded-lg bg-white px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-900">{scarcity}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-300">
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: w.progress_bar_color }} />
              </div>
              <p className="mt-1 text-center text-[10px] font-bold text-slate-900">{progress}% completo</p>
            </div>
          )}
        </div>
      </aside>
    </form>
  );
}
