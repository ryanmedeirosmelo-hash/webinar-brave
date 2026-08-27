"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, SalesNotification } from "@/types/db";
import { HwAvatar, hwColorFor } from "./HwKit";

type MsgData = { author_name: string; message: string; own?: boolean };

type Item =
  | { kind: "msg"; id: string; at: number; data: MsgData }
  | { kind: "sale"; id: string; at: number; data: SalesNotification };

/**
 * Nome para exibição: remove o sufixo de cidade/UF entre parênteses ou
 * colchetes (ex.: "daiane (Canoas/RS)" → "Daiane") e capitaliza. Mantém só o
 * nome para o chat não parecer roteirizado.
 */
function displayName(raw: string) {
  const noLocation = raw.replace(/\s*[([][^)\]]*[)\]]\s*$/g, "").trim();
  const base = noLocation || raw.trim();
  return base
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Só http/https. A cauda de pontuação fica de fora do link — sem isso um
 *  "veja em https://x.com/y." levaria o ponto final junto e quebraria a URL. */
const URL_NO_TEXTO = /(https?:\/\/[^\s<>"']+)/g;
const PONTUACAO_FINAL = /[.,;:!?)\]]+$/;

/** Rótulo curto do link: a URL de checkout completa ocupa três linhas no
 *  celular e polui o chat. Mostra domínio + primeiro trecho do caminho. */
function rotuloDoLink(url: string): string {
  try {
    const u = new URL(url);
    const caminho = u.pathname.replace(/\/$/, "");
    return (u.host + caminho).replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Transforma URLs do texto em links clicáveis. O roteiro do chat conta com
 *  isso — há mensagens do tipo "não consegui abrir o link". */
function comLinks(texto: string) {
  return texto.split(URL_NO_TEXTO).map((parte, i) => {
    if (i % 2 === 0) return parte;
    const cauda = parte.match(PONTUACAO_FINAL)?.[0] ?? "";
    const href = cauda ? parte.slice(0, -cauda.length) : parte;
    return (
      <span key={i}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-medium text-[var(--hw-red)] underline underline-offset-2 hover:text-[var(--hw-red-hover)]"
        >
          {rotuloDoLink(href)}
        </a>
        {cauda}
      </span>
    );
  });
}

export function SimulatedChat({
  messages,
  sales,
  salesTitle,
  elapsed,
  viewerName,
  presenterName,
  presenterAvatarUrl,
  viewers,
}: {
  messages: ChatMessage[];
  sales: SalesNotification[];
  salesTitle?: string | null;
  elapsed: number;
  viewerName?: string | null;
  /** Quem apresenta — recebe a foto no avatar (o resto do chat usa inicial). */
  presenterName?: string | null;
  presenterAvatarUrl?: string | null;
  /** Espectadores "assistindo agora" — mostrado no topo do chat. */
  viewers?: number | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const [draft, setDraft] = useState("");
  const [mine, setMine] = useState<{ id: string; at: number; message: string }[]>([]);

  const myName = displayName(viewerName?.trim() || "Você");

  const visible = useMemo<Item[]>(() => {
    const items: Item[] = [
      ...messages.map((m): Item => ({
        kind: "msg",
        id: m.id,
        at: m.at_seconds,
        data: { author_name: displayName(m.author_name), message: m.message },
      })),
      ...mine.map((m): Item => ({
        kind: "msg",
        id: m.id,
        at: m.at,
        data: { author_name: myName, message: m.message, own: true },
      })),
      ...sales.map((s): Item => ({ kind: "sale", id: s.id, at: s.at_seconds, data: s })),
    ];
    return items.filter((i) => i.at <= elapsed).sort((a, b) => a.at - b.at);
  }, [messages, mine, sales, elapsed, myName]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight; // auto-scroll
  }, [visible.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    seq.current += 1;
    setMine((prev) => [...prev, { id: `me-${seq.current}`, at: Math.max(0, elapsed), message: text }]);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--hw-border)] bg-[var(--hw-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--hw-border)] px-4 py-3">
        <span className="text-[15px] font-semibold">Chat ao vivo</span>
        <span className="rounded-full bg-[var(--hw-chip)] px-2.5 py-1 text-[12px] text-[var(--hw-muted)]">
          {viewers ? `👁 ${viewers} assistindo` : `${visible.length} mensagens`}
        </span>
      </div>

      <div ref={boxRef} className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5">
        {visible.length === 0 && (
          <p className="text-[14px] text-[var(--hw-muted)]">
            As mensagens aparecerão durante a aula…
          </p>
        )}
        {visible.map((item) =>
          item.kind === "sale" ? (
            // verde é o único desvio do vermelho: sinaliza conversão
            <div
              key={item.id}
              className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 animate-[fadeIn_.3s_ease]"
            >
              <span className="text-base">🛒</span>
              <div className="text-[13px] leading-tight">
                {salesTitle && (
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                    {salesTitle}
                  </p>
                )}
                <p>
                  <b>{item.data.buyer_name}</b> {item.data.product_label}
                  {item.data.buyer_city && (
                    <span className="text-[var(--hw-muted)]"> · {item.data.buyer_city}</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div key={item.id} className="flex items-start gap-2.5 animate-[fadeIn_.3s_ease]">
              <HwAvatar
                name={item.data.author_name}
                size={30}
                presenterName={presenterName}
                presenterAvatarUrl={presenterAvatarUrl}
              />
              <div className="min-w-0">
                <p
                  className="text-[13px] font-medium leading-tight"
                  style={{
                    color: item.data.own ? "var(--hw-red)" : hwColorFor(item.data.author_name),
                  }}
                >
                  {item.data.author_name}
                  {item.data.own && (
                    <span className="ml-1.5 rounded bg-[var(--hw-red)] px-1.5 py-px text-[10px] font-bold uppercase text-white">
                      você
                    </span>
                  )}
                </p>
                <p className="break-words text-[14px] leading-snug">
                  {comLinks(item.data.message)}
                </p>
              </div>
            </div>
          )
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-[var(--hw-border)] p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder="Enviar mensagem…"
          className="flex-1 rounded-full border border-[var(--hw-border)] bg-[var(--hw-bg-soft)] px-4 py-2.5 text-[14px] text-[var(--hw-text)] outline-none placeholder:text-[var(--hw-muted)] focus:border-[var(--hw-red)]"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-full bg-[var(--hw-red)] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[var(--hw-red-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
