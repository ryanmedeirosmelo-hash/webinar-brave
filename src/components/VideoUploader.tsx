"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function VideoUploader({
  webinarId,
  hasVideo,
}: {
  webinarId: string;
  hasVideo: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setDone(false);

    const form = new FormData();
    form.append("webinarId", webinarId);
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/admin/api/upload");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        setDone(true);
        router.refresh();
      } else {
        try {
          setError(JSON.parse(xhr.responseText).error ?? "Falha no upload.");
        } catch {
          setError("Falha no upload.");
        }
      }
      if (inputRef.current) inputRef.current.value = "";
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Erro de rede no upload.");
    };
    setProgress(0);
    xhr.send(form);
  }

  const uploading = progress !== null;

  return (
    <div className="rounded-lg border border-dashed border-slate-700 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <p className="text-slate-300 font-medium">Vídeo do webinar</p>
          <p className="text-slate-500 text-xs">
            {hasVideo ? "✅ Vídeo enviado (Storage)" : "Nenhum vídeo enviado ainda — usando a URL abaixo."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white"
        >
          {uploading ? `Enviando… ${progress}%` : hasVideo ? "Trocar vídeo" : "⬆ Enviar vídeo (MP4)"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/*"
          className="hidden"
          onChange={onPick}
        />
      </div>

      {uploading && (
        <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-cyan-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {done && <p className="mt-2 text-xs text-emerald-400">Vídeo atualizado! ✅</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
