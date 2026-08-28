import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { saveIntegrations } from "@/app/admin/actions";
import { input, card, saveBtn } from "../_steps";
import { Toggle, SectionTitle } from "../_fields";
import type { Webinar } from "@/types/db";

export const dynamic = "force-dynamic";

const INTEGRATIONS: { key: string; name: string; mono: string; tint: string; placeholder: string; hint?: string }[] = [
  { key: "active_campaign", name: "Active Campaign", mono: "AC", tint: "text-sky-300 bg-sky-400/10", placeholder: "API URL / token" },
  {
    key: "whatsapp",
    name: "WhatsApp de suporte",
    mono: "WA",
    tint: "text-emerald-300 bg-emerald-400/10",
    placeholder: "Ex.: (11) 99999-9999",
    hint: "Exibe o botão de suporte no fim da aula. Números do Brasil recebem o DDI +55 automaticamente.",
  },
  { key: "keap", name: "Keap", mono: "Kp", tint: "text-orange-300 bg-orange-400/10", placeholder: "Token" },
  { key: "sellflux", name: "SellFlux", mono: "SF", tint: "text-slate-300 bg-slate-400/10", placeholder: "Webhook / token" },
  { key: "kommo", name: "Kommo", mono: "Km", tint: "text-violet-300 bg-violet-400/10", placeholder: "Token" },
  { key: "manychat", name: "ManyChat", mono: "MC", tint: "text-blue-300 bg-blue-400/10", placeholder: "Token" },
  { key: "webhook", name: "WebHook", mono: "WH", tint: "text-[#e3cfa0] bg-[#cbad78]/10", placeholder: "https://…/webhook" },
  { key: "gtm", name: "Google Tag Manager", mono: "GT", tint: "text-amber-300 bg-amber-400/10", placeholder: "GTM-XXXX" },
  { key: "custom_script", name: "Script personalizado", mono: "{}", tint: "text-slate-300 bg-slate-400/10", placeholder: "<script>…</script>" },
  { key: "facebook_pixel", name: "Facebook Pixel", mono: "f", tint: "text-blue-300 bg-blue-400/10", placeholder: "Pixel ID" },
  { key: "tiktok_pixel", name: "Tiktok Pixel", mono: "TT", tint: "text-rose-300 bg-rose-400/10", placeholder: "Pixel ID" },
];

type Cfg = { enabled?: boolean; value?: string };

export default async function StepIntegracoes({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: w } = await supabaseAdmin()
    .from("webinars")
    .select("integrations")
    .eq("id", id)
    .single<Pick<Webinar, "integrations">>();
  if (!w) notFound();

  const map = (w.integrations ?? {}) as Record<string, Cfg>;

  return (
    <form action={saveIntegrations} className={`${card} max-w-4xl`}>
      <input type="hidden" name="webinar_id" value={id} />
      <input type="hidden" name="__redirect" value="/admin" />

      <SectionTitle icon="grid" hint="Ligue e configure as integrações deste webinar.">
        Suas integrações
      </SectionTitle>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {INTEGRATIONS.map((it) => {
          const cfg = map[it.key] ?? {};
          return (
            <div key={it.key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${it.tint}`}>
                    {it.mono}
                  </span>
                  {it.name}
                </span>
                <span className={`h-2 w-2 rounded-full ${cfg.enabled ? "bg-emerald-400" : "bg-slate-600"}`} />
              </div>
              <Toggle
                name={`int_${it.key}_enabled`}
                defaultChecked={!!cfg.enabled}
                label={it.key === "whatsapp" ? "Exibir botão" : "Ativar"}
              />
              <input
                name={`int_${it.key}_value`}
                defaultValue={cfg.value ?? ""}
                placeholder={it.placeholder}
                className={`${input} text-xs`}
              />
              {it.hint && <p className="text-[11px] leading-snug text-slate-500">{it.hint}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button className={saveBtn}>Concluir ✓</button>
      </div>
    </form>
  );
}
