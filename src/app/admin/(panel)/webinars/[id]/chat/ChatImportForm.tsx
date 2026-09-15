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
    <form action={action} encType="multipart/form-data" className="mt-3">
      <input type="hidden" name="webinar_id" value={webinarId} />
      <label htmlFor="chat-import-file" className={label}>
        Envie um arquivo Excel (.xls ou .xlsx)
      </label>
      <input
        id="chat-import-file"
        name="file"
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="block w-full rounded-lg border border-dashed border-slate-700 bg-slate-900/70 px-3.5 py-3 text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:border-slate-600"
      />
      <p className="mt-1.5 text-xs leading-5 text-slate-500">
        Use a primeira aba com as colunas: Hora para ser enviado, Minuto para ser enviado, Segundo para ser enviado, Nome do participante e Texto enviado.
      </p>
      <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-600">
        <span className="h-px flex-1 bg-slate-800" />
        <span>ou cole os dados</span>
        <span className="h-px flex-1 bg-slate-800" />
      </div>
      <label htmlFor="chat-import" className={label}>
        Cole a planilha (tempo, nome, mensagem ou hora, minuto, segundo, nome, mensagem)
      </label>
      <textarea
        id="chat-import"
        name="csv"
        rows={5}
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
