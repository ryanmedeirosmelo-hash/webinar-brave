"use client";

import { useState } from "react";

/** Ações para os links públicos que o painel gera a partir do slug. */
export function PublicLinkActions({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = new URL(path, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      window.prompt("Copie o link da página final:", url);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={path}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded-lg bg-[#cbad78] px-3 py-2 text-xs font-semibold text-[#111827] transition hover:bg-[#dcc28f]"
      >
        Visualizar página final ↗
      </a>
      <button
        type="button"
        onClick={copyLink}
        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
      >
        {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}
