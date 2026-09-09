"use client";

import { useActionState } from "react";
import { importChatCsv, type ChatImportState } from "@/app/admin/actions";
import { input, label } from "../_steps";

export function ChatImportForm({ webinarId }: { webinarId: string }) {
  const [state, action, pending] = useActionState<ChatImportState, FormData>(
    importChatCsv,
    undefined
  );

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="webinar_id" value={webinarId} />
      <label htmlFor="chat-import" className={label}>
        Cole a planilha (tempo, nome, mensagem ou hora, minuto, segundo, nome, mensagem)
      </label>
      <textarea
        id="chat-import"
        name="csv"
        rows={5}
        required
        aria-describedby="chat-import-feedback"
        placeholder={"00:00:18, Daiane (Canoas/RS), Boa noite gente!! presente\n45, Patrícia, Goiânia aqui!"}
        className={input}
      />
      <div id="chat-import-feedback" className="mt-2 min-h-5" aria-live="polite">
        {state?.error && <p className="text-sm text-red-300">{state.error}</p>}
        {state?.success && <p className="text-sm text-emerald-300">{state.success}</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60 px-4 py-2 text-sm text-white"
      >
        {pending ? "Importando…" : "Importar mensagens"}
      </button>
    </form>
  );
}
