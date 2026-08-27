import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { saveOffer } from "@/app/admin/actions";
import { ImageUploader } from "@/components/ImageUploader";
import { input, label, card, saveBtn } from "../_steps";
import { Toggle, ColorField, HmsField } from "../_fields";
import type { Offer } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function StepOferta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { data: wb } = await supabase.from("webinars").select("id").eq("id", id).single();
  if (!wb) notFound();

  const { data: o } = await supabase
    .from("offers")
    .select("*")
    .eq("webinar_id", id)
    .order("show_at_seconds")
    .limit(1)
    .maybeSingle<Offer>();

  return (
    <form action={saveOffer} className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      <input type="hidden" name="webinar_id" value={id} />
      <input type="hidden" name="__redirect" value={`/admin/webinars/${id}/chat`} />

      <div className={`${card} space-y-4`}>
        <div>
          <label className={label}>Nome da oferta * (interno)</label>
          <input name="name" defaultValue={o?.name ?? ""} placeholder="Nome do produto" className={input} />
        </div>
        <div>
          <label className={label}>Título da oferta *</label>
          <input name="title" defaultValue={o?.title ?? ""} placeholder="Nome do produto" className={input} required />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Preço original</label>
            <input name="price_original_text" defaultValue={o?.price_original_text ?? ""} placeholder="R$597" className={input} />
          </div>
          <div>
            <label className={label}>Preço da oferta</label>
            <input name="price_offer_text" defaultValue={o?.price_offer_text ?? ""} placeholder="6x de R$110" className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Texto do botão *</label>
          <input name="cta_label" defaultValue={o?.cta_label ?? ""} placeholder="QUERO MINHA MÁQUINA DE VENDAS" className={input} required />
        </div>
        <ColorField name="button_color" defaultValue={o?.button_color ?? "#16a34a"} label="Cor do botão" />

        <div className="grid sm:grid-cols-2 gap-4">
          <ImageUploader name="image_desktop_url" webinarId={id} defaultUrl={o?.image_desktop_url} label="Imagem da oferta (desktop)" />
          <ImageUploader name="image_mobile_url" webinarId={id} defaultUrl={o?.image_mobile_url} label="Imagem da oferta (mobile)" />
        </div>

        <div className="grid sm:grid-cols-3 gap-4 border-t border-slate-800 pt-4">
          <HmsField prefix="pitch" label="Início da pitch" totalSeconds={o?.pitch_start_seconds ?? 0} />
          <HmsField prefix="show" label="Início da oferta *" totalSeconds={o?.show_at_seconds ?? 0} />
          <HmsField prefix="hide" label="Fim da oferta" totalSeconds={o?.hide_at_seconds ?? 0} />
        </div>

        <div>
          <label className={label}>Link da oferta *</label>
          <input name="cta_url" defaultValue={o?.cta_url ?? ""} placeholder="https://pay.hotmart.com/…" className={input} required />
        </div>

        <div className="space-y-2.5 border-t border-slate-800 pt-4">
          <Toggle name="utm_passthrough" defaultChecked={o?.utm_passthrough ?? true} label="Repassar UTM's pro link da oferta" />
          <Toggle name="disabled" defaultChecked={o?.disabled ?? false} label="Desabilitar oferta" />
          <Toggle name="open_same_window" defaultChecked={o?.open_same_window ?? false} label="Abrir o link na mesma janela do webinar" />
          <Toggle name="raffle_enabled" defaultChecked={o?.raffle_enabled ?? false} label="Habilitar sorteio" />
        </div>

        <div className="flex justify-end">
          <button className={saveBtn}>Continuar ›</button>
        </div>
      </div>

      {/* Prévia */}
      <aside className="lg:sticky lg:top-4">
        <p className="text-xs text-slate-500 mb-2">Prévia da oferta</p>
        <div className="rounded-xl bg-white text-slate-900 p-4 shadow-xl">
          {o?.image_desktop_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.image_desktop_url} alt="" className="rounded-lg w-full object-cover mb-3" />
          ) : (
            <div className="rounded-lg bg-slate-900 text-white text-center py-10 mb-3">
              <p className="text-2xl font-extrabold">{o?.price_offer_text || "Sua oferta"}</p>
            </div>
          )}
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-400 line-through">{o?.price_original_text}</span>
            <span className="text-rose-600 font-semibold">Por tempo limitado</span>
          </div>
          <p className="font-bold text-lg">Por {o?.price_offer_text || "—"}</p>
          <button
            type="button"
            className="mt-3 w-full rounded-md px-3 py-3 text-sm font-bold text-white"
            style={{ background: o?.button_color ?? "#16a34a" }}
          >
            {o?.cta_label || "QUERO COMPRAR"}
          </button>
          <p className="mt-3 text-center text-2xl font-bold tabular-nums">05:00</p>
        </div>
      </aside>
    </form>
  );
}
