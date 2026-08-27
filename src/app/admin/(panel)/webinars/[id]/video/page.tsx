import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { updateWebinar } from "@/app/admin/actions";
import { formatDuration } from "@/lib/time";
import { VideoUploader } from "@/components/VideoUploader";
import { VideoPreview } from "@/components/VideoPreview";
import { resolveVideoSource } from "@/lib/video-source";
import { input, label, card, saveBtn } from "../_steps";
import { Toggle } from "../_fields";
import type { Webinar } from "@/types/db";

export const dynamic = "force-dynamic";

const PROVIDERS = ["vimeo", "bunny", "mp4", "cloudflare", "vidyard", "wistia", "dailymotion"];

export default async function StepVideo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: w } = await supabaseAdmin()
    .from("webinars")
    .select("*")
    .eq("id", id)
    .single<Webinar>();
  if (!w) notFound();

  const source = resolveVideoSource(w);

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
      <form action={updateWebinar} className={`${card} space-y-5`}>
        <input type="hidden" name="id" value={w.id} />
        <input type="hidden" name="video_present" value="1" />
        <input type="hidden" name="__redirect" value={`/admin/webinars/${w.id}/oferta`} />

        {/* Upload próprio */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
            <input type="radio" name="video_provider" value="upload" defaultChecked={w.video_provider === "upload"} />
            Escolha aqui o vídeo do seu webinar
          </label>
          <VideoUploader webinarId={w.id} hasVideo={!!w.video_path} />
        </div>

        {/* Provedores externos */}
        <div className="border-t border-slate-800 pt-5">
          <p className="text-sm font-medium text-white mb-3">Ou escolha um vídeo de um provedor</p>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDERS.map((p) => (
              <label
                key={p}
                className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-300 cursor-pointer hover:border-[#cbad78] capitalize"
              >
                <input type="radio" name="video_provider" value={p} defaultChecked={w.video_provider === p} />
                {p}
              </label>
            ))}
          </div>
          <div className="mt-3">
            <label className={label}>Link do vídeo (m3u8 / URL do provedor)</label>
            <input name="video_external_url" defaultValue={w.video_external_url ?? ""} placeholder="https://…/playlist.m3u8" className={input} />
            <p className="mt-1 text-xs text-slate-500">
              A aula controla o vídeo (trava o tempo, bloqueia pause/avanço), então precisa de um
              MP4 ou de uma playlist <code>.m3u8</code> — o link de embed/iframe do provedor é uma
              página HTML e não toca. No Bunny, use{" "}
              <code>https://SEU-CDN.b-cdn.net/&lt;id-do-video&gt;/playlist.m3u8</code>.
            </p>
          </div>
          <div className="mt-3">
            <label className={label}>Duração do vídeo (hh:mm:ss)</label>
            <input
              name="video_duration"
              defaultValue={w.video_external_url ? formatDuration(w.duration_seconds) : ""}
              placeholder="01:15:40"
              className={input}
            />
            <p className="mt-1 text-xs text-slate-500">
              Obrigatório para provedores externos — define quando a transmissão simulada termina.
              O upload próprio detecta sozinho.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-5 space-y-3">
          <Toggle name="video_autoplay" defaultChecked={w.video_autoplay} label="Definir como auto play" />
          <Toggle name="video_fullscreen" defaultChecked={w.video_fullscreen} label="Habilitar fullscreen" />
        </div>

        <div className="flex justify-end">
          <button className={saveBtn}>Continuar ›</button>
        </div>
      </form>

      {/* Prévia */}
      <aside className="lg:sticky lg:top-4">
        <p className="text-xs text-slate-500 mb-2">Prévia</p>
        <VideoPreview src={source.url} problem={source.problem} />
      </aside>
    </div>
  );
}
