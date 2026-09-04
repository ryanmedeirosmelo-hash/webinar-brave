import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { updateWebinar } from "@/app/admin/actions";
import { PublicLinkActions } from "@/components/PublicLinkActions";
import { publicLeadOrigin } from "@/lib/public-links";
import { input, label, card, saveBtn } from "../_steps";
import type { Webinar } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function StepInicio({
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
  const leadOrigin = publicLeadOrigin();

  return (
    <form action={updateWebinar} className={`${card} max-w-3xl`}>
      <input type="hidden" name="id" value={w.id} />
      <input type="hidden" name="__redirect" value={`/admin/webinars/${w.id}/webinar`} />

      <div className="space-y-5">
        <div>
          <label className={label}>
            Nome do webinar <span className="text-red-400">*</span>
            <span className="text-slate-600"> (interno, só você vê)</span>
          </label>
          <input
            name="internal_name"
            required
            defaultValue={w.internal_name ?? ""}
            placeholder="Webinar - Segunda-feira"
            className={input}
          />
        </div>

        <div>
          <label className={label}>
            Título do webinar <span className="text-slate-600">(aparece pro público)</span>
          </label>
          <input
            name="title"
            defaultValue={w.title}
            placeholder="Aula Inaugural - Segunda-feira"
            className={input}
          />
        </div>

        <div>
          <label className={label}>
            URL amigável <span className="text-red-400">*</span>
          </label>
          <div className="flex items-stretch">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-700 bg-slate-900 px-3 text-sm text-slate-500">
              /
            </span>
            <input
              name="slug"
              required
              defaultValue={w.slug}
              placeholder="aula-seg"
              className={`${input} rounded-l-none`}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Página pública: <span className="text-slate-400">/{w.slug}</span>
          </p>
        </div>

        <div className="rounded-xl border border-[#cbad78]/30 bg-[#cbad78]/[0.07] p-4">
          <p className="text-sm font-semibold text-[#e4c88f]">Página final / de agradecimento</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Este link é criado automaticamente para este webinar. A página usa o título, a marca,
            a apresentação e o suporte configurados aqui.
          </p>
          <code className="mt-3 block w-fit rounded bg-slate-950/60 px-2 py-1 text-xs text-slate-300">
            /obrigado/{w.slug}
          </code>
          <div className="mt-3">
            <PublicLinkActions
              path={`/obrigado/${w.slug}`}
              pageName="página final"
              origin={leadOrigin}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className={label}>Escolha o idioma</label>
            <select name="language" defaultValue={w.language} className={input}>
              <option value="pt-BR">🇧🇷 Português (Brasil)</option>
              <option value="en-US">🇺🇸 English (US)</option>
              <option value="es-ES">🇪🇸 Español</option>
            </select>
          </div>
          <div>
            <label className={label}>Nome do apresentador</label>
            <input
              name="presenter_name"
              defaultValue={w.presenter_name ?? ""}
              placeholder="Nome de quem apresenta"
              className={input}
            />
          </div>
        </div>

        <div>
          <label className={label}>Foto do apresentador (URL)</label>
          <div className="flex items-center gap-3">
            {w.presenter_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={w.presenter_avatar_url}
                alt=""
                className="h-12 w-12 rounded-full object-cover border border-slate-700"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-slate-800 grid place-items-center text-slate-500">
                👤
              </div>
            )}
            <input
              name="presenter_avatar_url"
              defaultValue={w.presenter_avatar_url ?? ""}
              placeholder="https://…/foto.jpg"
              className={input}
            />
          </div>
        </div>

        <details className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-300">
            Opções avançadas
          </summary>
          <div className="mt-4">
            <label className={label}>Status</label>
            <select name="status" defaultValue={w.status} className={`${input} max-w-xs`}>
              <option value="active">Ativo</option>
              <option value="draft">Rascunho</option>
            </select>
          </div>
        </details>
      </div>

      <div className="mt-6 flex justify-end">
        <button className={saveBtn}>Continuar ›</button>
      </div>
    </form>
  );
}
