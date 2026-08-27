"use client";

import { useRef, useState } from "react";

/**
 * Sobe a imagem na hora e guarda a URL (/img/<key>) num input hidden com `name`,
 * pra a etapa do wizard salvar junto no submit. Mostra prévia + progresso.
 */
export function ImageUploader({
  name,
  webinarId,
  defaultUrl,
  label,
  hint,
  className = "",
}: {
  name: string;
  webinarId: string;
  defaultUrl?: string | null;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const form = new FormData();
    form.append("webinarId", webinarId);
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/admin/api/upload-image");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        setUrl(JSON.parse(xhr.responseText).url);
      } else {
        try {
          setError(JSON.parse(xhr.responseText).error ?? "Falha no upload.");
        } catch {
          setError("Falha no upload.");
        }
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Erro de rede no upload.");
    };
    setProgress(0);
    xhr.send(form);
  }

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}
      <input type="hidden" name={name} value={url} />
      <div className="rounded-lg border border-dashed border-slate-700 p-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-h-24 rounded mb-2 object-contain" />
        ) : (
          <p className="text-center text-xs text-slate-500 py-4">
            {hint ?? "Arraste a imagem ou clique para selecionar."}
          </p>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {progress !== null ? `Enviando… ${progress}%` : url ? "⬆ Alterar imagem" : "⬆ Enviar imagem"}
        </button>
        {url && (
          <button
            type="button"
            onClick={() => setUrl("")}
            className="mt-1.5 w-full text-xs text-red-400 hover:text-red-300"
          >
            Remover imagem
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
