"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getLiveWatchState, type LiveWatchState } from "@/app/admin/actions";

const Ctx = createContext<LiveWatchState>({});

/**
 * Distribui o estado "ao vivo agora" pra lista de webinars e revalida a cada 15s
 * (o servidor é a fonte da verdade — client só faz poll leve). Recebe um snapshot
 * inicial renderizado no servidor pra não piscar.
 */
export function LiveWatchProvider({
  initial,
  children,
}: {
  initial: LiveWatchState;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<LiveWatchState>(initial);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const next = await getLiveWatchState();
        if (alive) setState(next);
      } catch {
        /* rede caiu; mantém o último estado e tenta de novo */
      }
    };
    const id = setInterval(tick, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

/** Selo 🔴 AO VIVO · N assistindo. Não renderiza nada se a sala não está no ar. */
export function LiveBadge({ webinarId }: { webinarId: string }) {
  const s = useContext(Ctx)[webinarId];
  if (!s || (!s.isLive && s.watching === 0)) return null;

  const n = s.watching;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/30"
      title={`${n} ${n === 1 ? "pessoa assistindo" : "pessoas assistindo"} agora`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      AO VIVO
      <span className="font-medium text-red-200/90">
        · {n} assistindo
      </span>
    </span>
  );
}
