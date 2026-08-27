import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  addChatMessage,
  deleteChatMessage,
  generateChat,
  clearChat,
  importChatCsv,
} from "@/app/admin/actions";
import { input, label, card, saveBtn } from "../_steps";
import type { ChatMessage } from "@/types/db";

export const dynamic = "force-dynamic";

function hhmmss(total: number) {
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default async function StepChat({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseAdmin();
  const { data: wb } = await supabase.from("webinars").select("id").eq("id", id).single();
  if (!wb) notFound();

  const { data: chat } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("webinar_id", id)
    .order("at_seconds");
  const messages = (chat ?? []) as ChatMessage[];

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      {/* Configurar */}
      <div className="space-y-4">
        <h2 className="font-semibold text-white">Configure seu chat</h2>

        {/* IA */}
        <div className={`${card} border-[#cbad78]/30`}>
          <span className="inline-block rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white mb-2">
            Novidade
          </span>
          <h3 className="font-semibold text-white">Automação Inteligente de Chat</h3>
          <p className="text-sm text-slate-400 mb-3">
            Gere mensagens automáticas e simule engajamento no chat do seu webinar.
          </p>
          <form action={generateChat} className="flex items-center gap-2">
            <input type="hidden" name="webinar_id" value={id} />
            <input name="count" type="number" defaultValue={30} min={1} max={120} className={`${input} w-20`} />
            <button className="flex-1 rounded-lg bg-gradient-to-b from-[#d9bd8a] to-[#c3a267] hover:from-[#e3cfa0] hover:to-[#cbad78] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/30 transition">
              Gerar Chat com IA
            </button>
          </form>
        </div>

        {/* Via arquivo */}
        <details className={card}>
          <summary className="cursor-pointer font-medium text-slate-200">Crie o chat via arquivo</summary>
          <form action={importChatCsv} className="mt-3">
            <input type="hidden" name="webinar_id" value={id} />
            <label className={label}>Cole a planilha (uma linha por mensagem: tempo, nome, mensagem)</label>
            <textarea
              name="csv"
              rows={5}
              placeholder={"00:00:18, Daiane (Canoas/RS), Boa noite gente!! presente\n45, Patrícia, Goiânia aqui!"}
              className={input}
            />
            <button className="mt-2 rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white">
              Importar mensagens
            </button>
          </form>
        </details>

        {/* Individual */}
        <details className={card}>
          <summary className="cursor-pointer font-medium text-slate-200">Crie o chat individual</summary>
          <form action={addChatMessage} className="mt-3 flex flex-wrap gap-2 items-end">
            <input type="hidden" name="webinar_id" value={id} />
            <div className="w-24">
              <label className={label}>Seg.</label>
              <input name="at_seconds" type="number" defaultValue={0} className={input} />
            </div>
            <div className="w-40">
              <label className={label}>Autor</label>
              <input name="author_name" placeholder="Ana Souza" className={input} />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className={label}>Mensagem</label>
              <input name="message" placeholder="Boa noite!" className={input} required />
            </div>
            <button className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm text-white">+ Add</button>
          </form>
        </details>

        <div className="flex justify-end">
          <Link href={`/admin/webinars/${id}/vendas`} className={saveBtn}>Continuar ›</Link>
        </div>
      </div>

      {/* Prévia */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Prévia do chat ({messages.length})</h2>
          {messages.length > 0 && (
            <form action={clearChat}>
              <input type="hidden" name="webinar_id" value={id} />
              <button className="text-sm text-red-400 hover:text-red-300">Excluir todo o chat</button>
            </form>
          )}
        </div>
        <ul className="space-y-1.5 max-h-[460px] overflow-y-auto">
          {messages.map((m) => (
            <li key={m.id} className="flex items-center gap-3 text-sm border-b border-slate-800/60 pb-1.5">
              <span className="w-16 shrink-0 tabular-nums text-[#cbad78]">{hhmmss(m.at_seconds)}</span>
              <span className="font-medium text-slate-300 shrink-0">{m.author_name}</span>
              <span className="flex-1 text-slate-200 truncate">{m.message}</span>
              <form action={deleteChatMessage}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="webinar_id" value={id} />
                <button className="text-red-400 hover:text-red-300">✕</button>
              </form>
            </li>
          ))}
          {messages.length === 0 && <li className="text-sm text-slate-500">Sem mensagens ainda.</li>}
        </ul>
      </div>
    </div>
  );
}
