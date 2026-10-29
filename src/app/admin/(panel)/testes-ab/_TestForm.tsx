"use client";

import { useActionState, useState } from "react";
import { saveABTest } from "./actions";
import { abPublicPath } from "@/lib/ab-links";
import type { ABTest, ABActionState } from "@/lib/ab-tests";

export type WebinarOption = { id: string; title: string; internal_name: string | null; status: string };
const control = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#cbad78]";

export function TestForm({ webinars, test }: { webinars: WebinarOption[]; test?: ABTest }) {
  const [state, action, pending] = useActionState(saveABTest, {} as ABActionState);
  const [variants, setVariants] = useState(test?.variants ?? [
    { webinar_id: webinars[0]?.id ?? "", weight: 50 },
    { webinar_id: webinars[1]?.id ?? "", weight: 50 },
  ]);
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  const valid = total === 100 && variants.every(v => v.webinar_id && Number.isInteger(v.weight) && v.weight >= 0 && v.weight <= 100)
    && new Set(variants.map(v => v.webinar_id)).size === variants.length;
  const update = (index: number, patch: Partial<typeof variants[number]>) =>
    setVariants(items => items.map((v, i) => i === index ? { ...v, ...patch } : v));
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={test?.id ?? ""} />
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />
      <label className="block text-sm text-slate-300">Nome do teste
        <input name="name" required maxLength={100} defaultValue={test?.name} placeholder="Ex.: Aula original × nova apresentação" className={`${control} mt-2`} />
      </label>
      <label className="block text-sm text-slate-300">URL amigável do teste
        <div className="mt-2 flex items-center gap-2"><span className="text-slate-400">/ab/</span><input name="slug" maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={test?.slug ?? ""} placeholder="nome-do-teste" className={control} /></div>
        <span className="mt-2 block text-xs leading-5 text-slate-400">Use letras minúsculas, números e hífens. Deixe vazio para usar o endereço automático. Este nome vale para todos os links do teste.</span>
      </label>
      {test && <p className="text-xs leading-5 text-slate-400">Ao mudar o endereço, atualize os links já compartilhados. O link fixo <span className="break-all">{abPublicPath({ id: test.id }, "principal")}</span> continua funcionando.</p>}
      <div className="space-y-3">
        {variants.map((variant, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_90px_auto] items-end gap-3">
            <label className="min-w-0 text-xs text-slate-400">Variante {String.fromCharCode(65 + index)}
              <select required aria-label={`Webinar da variante ${String.fromCharCode(65 + index)}`} value={variant.webinar_id} onChange={e => update(index, { webinar_id: e.target.value })} className={`${control} mt-1`}>
                <option value="">Escolha um webinar</option>
                {webinars.map(w => <option key={w.id} value={w.id} disabled={w.status !== "active"}>{w.internal_name || w.title}{w.status !== "active" ? " (rascunho)" : ""}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">Tráfego (%)
              <input type="number" min={0} max={100} step={1} required value={variant.weight} onChange={e => update(index, { weight: Number(e.target.value) })} className={`${control} mt-1`} aria-label={`Porcentagem da variante ${String.fromCharCode(65 + index)}`} />
            </label>
            <button type="button" disabled={variants.length <= 2} onClick={() => setVariants(items => items.filter((_, i) => i !== index))} className="h-10 px-2 text-sm text-slate-400 hover:text-red-300 disabled:opacity-25" aria-label={`Remover variante ${String.fromCharCode(65 + index)}`}>×</button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" disabled={variants.length >= 10} onClick={() => setVariants(items => [...items, { webinar_id: "", weight: 0 }])} className="text-[#cbad78] disabled:opacity-40">+ Adicionar webinar</button>
        <span className={total === 100 ? "text-emerald-300" : "text-amber-300"} aria-live="polite">{total}% de 100%</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        {variants.map((v, i) => <div key={i} style={{ width: `${v.weight}%`, backgroundColor: ["#cbad78", "#38bdf8", "#a78bfa", "#34d399"][i % 4] }} />)}
      </div>
      <p className="text-xs leading-relaxed text-slate-400">A cada 100 novos visitantes, a meta é direcionar {variants.map((v, i) => `${v.weight} para ${String.fromCharCode(65 + i)}`).join(", ")}. A distribuição é aleatória e pode variar, especialmente no início. Quem retorna pelo mesmo navegador mantém a variante por até um ano.</p>
      <label className="flex items-center gap-2 text-sm text-slate-300"><input name="active" type="checkbox" defaultChecked={test?.active ?? true} /> Receber novos visitantes</label>
      {test && <p className="text-xs text-slate-500">Ao pausar, visitantes já distribuídos continuam acessando a variante original. Mudanças nas porcentagens valem apenas para novos visitantes.</p>}
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-300">{state.success}</p>}
      <button disabled={pending || !valid} className="rounded-lg bg-[#cbad78] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-[#dcc28f] disabled:cursor-not-allowed disabled:opacity-40">{pending ? "Salvando…" : test ? "Salvar alterações" : "Criar teste"}</button>
    </form>
  );
}
