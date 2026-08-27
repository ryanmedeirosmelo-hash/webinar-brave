"use client";

import { useState } from "react";
import { RegisterGate } from "@/components/RegisterGate";
import type { Webinar, ChatMessage, Offer, SalesNotification } from "@/types/db";

/* Revisão local das telas do lead com os DADOS REAIS do webinar (título,
 * apresentadora, chat, ofertas e link de checkout). O seletor de baixo troca a
 * tela; nada aqui vai pro ar — a página é noindex e não bate heartbeat. */

type Tela = "cadastro" | "contagem" | "aovivo" | "encerrada";

const TELAS: { id: Tela; label: string }[] = [
  { id: "cadastro", label: "Cadastro" },
  { id: "contagem", label: "Contagem" },
  { id: "aovivo", label: "Ao vivo" },
  { id: "encerrada", label: "Encerrada" },
];

export function RascunhoReal({
  webinar,
  videoUrl,
  messages,
  offers,
  sales,
  telaInicial = "cadastro",
  escuroInicial = false,
}: {
  webinar: Webinar;
  videoUrl: string;
  messages: ChatMessage[];
  offers: Offer[];
  sales: SalesNotification[];
  telaInicial?: Tela;
  escuroInicial?: boolean;
}) {
  const [tela, setTela] = useState<Tela>(telaInicial);
  const [escuro, setEscuro] = useState(escuroInicial);

  return (
    <div className="hw-theme min-h-dvh pb-24" data-mode={escuro ? "dark" : undefined}>
      {/* key: remonta o gate ao trocar de tela (zera timers e o vídeo) */}
      <RegisterGate
        key={tela}
        webinar={webinar}
        videoUrl={videoUrl}
        messages={messages}
        offers={offers}
        sales={sales}
        draftView={tela}
      />

      <nav
        aria-label="Telas do rascunho"
        className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-[#111]/95 p-1.5 text-white shadow-2xl backdrop-blur"
      >
        {TELAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTela(item.id)}
            className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition ${
              tela === item.id ? "bg-[#ff0000] text-white" : "text-white/70 hover:bg-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-white/15" />
        <button
          type="button"
          onClick={() => setEscuro((v) => !v)}
          title="Alternar claro/escuro"
          className="rounded-full px-3.5 py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/10"
        >
          {escuro ? "🌙 Escuro" : "☀️ Claro"}
        </button>
      </nav>
    </div>
  );
}
