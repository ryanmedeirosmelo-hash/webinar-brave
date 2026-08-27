"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Prévia do vídeo no painel. Usa a mesma pilha do player da aula (hls.js para
 * .m3u8) para que o admin veja aqui exatamente o que o espectador veria — e,
 * quando a fonte não toca, mostre o erro em vez de um spinner infinito.
 */
export function VideoPreview({ src, problem }: { src: string; problem: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError(null);

    const isHls = /\.m3u8(\?|$)/i.test(src);
    const isSafari =
      typeof navigator !== "undefined" &&
      /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

    if (isHls && !isSafari) {
      let hls: { destroy: () => void } | null = null;
      let cancelled = false;
      import("hls.js").then(({ default: Hls }) => {
        const v = videoRef.current;
        if (cancelled || !v) return;
        if (Hls.isSupported()) {
          const inst = new Hls();
          inst.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) {
              setError(
                "Não foi possível carregar o HLS. Verifique se a biblioteca permite acesso " +
                  "direto à URL (sem token/referrer) e se o CORS está liberado."
              );
            }
          });
          inst.loadSource(src);
          inst.attachMedia(v);
          hls = inst;
        } else {
          v.src = src;
        }
      });
      return () => {
        cancelled = true;
        hls?.destroy();
      };
    }

    video.src = src;
  }, [src]);

  return (
    <>
      <div className="rounded-xl overflow-hidden bg-black aspect-video">
        {src ? (
          <video
            ref={videoRef}
            controls
            playsInline
            muted
            onError={() => setError("O navegador não conseguiu tocar esta fonte de vídeo.")}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="h-full grid place-items-center px-4 text-center text-slate-600 text-sm">
            {problem ? "Fonte de vídeo inválida" : "Envie um vídeo para ver a prévia"}
          </div>
        )}
      </div>
      {(problem || error) && (
        <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300">
          {problem ?? error}
        </p>
      )}
    </>
  );
}
