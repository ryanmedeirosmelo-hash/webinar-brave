import { SignupForm } from "@/components/SignupForm";
import { displayTitle } from "@/components/Brand";
import { paragraphs, richText } from "@/lib/rich-text";
import type { Webinar } from "@/types/db";

/**
 * Página de captura: card branco sobre fundo preto, com o texto e o formulário
 * à esquerda, a imagem à direita e a faixa de escassez embaixo.
 *
 * Todo o conteúdo vem da etapa Login do painel (título, imagem, cores do botão,
 * campos do formulário, barra de progresso) — nada é fixo no código.
 */
export function CaptureLanding({ webinar }: { webinar: Webinar }) {
  const heading = webinar.capture_title?.trim() || displayTitle(webinar.title);
  const body = webinar.description?.trim();
  const image = webinar.capture_image_url?.trim();
  const scarcity = webinar.capture_scarcity_text?.trim() || "Não perca tempo, vagas acabando:";
  const progress = Math.min(100, Math.max(0, webinar.progress_start ?? 0));

  return (
    <div className="cap-theme min-h-full py-6 sm:py-10">
      <div className="mx-auto w-full max-w-[1240px] px-3 sm:px-5">
        <div className="rounded-[26px] bg-white px-6 py-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] sm:px-10 sm:py-12 lg:px-14">
          <div className="grid items-center gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-14">
            {/* ---- Texto + formulário ---- */}
            <div className="min-w-0">
              {webinar.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={webinar.logo_url} alt="" className="mb-6 h-10 w-auto object-contain" />
              )}

              <h1 className="text-[20px] font-bold leading-[1.18] tracking-[-0.01em] text-[color:var(--cap-ink)] sm:text-[34px]">
                {richText(heading)}
              </h1>

              {body && (
                <div className="mt-5 space-y-3.5">
                  {paragraphs(body).map((p, i) => (
                    <p key={i} className="text-[12px] leading-[1.62] text-[color:var(--cap-muted)] sm:text-[17px]">
                      {richText(p)}
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-7">
                <SignupForm
                  webinarId={webinar.id}
                  availableTimes={webinar.available_times}
                  timezone={webinar.timezone}
                  type={webinar.type}
                  jitIntervalMinutes={webinar.jit_interval_minutes}
                  durationSeconds={webinar.duration_seconds}
                  recurrenceEnabled={webinar.recurrence_enabled}
                  recurrenceFreq={webinar.recurrence_freq}
                  recurrenceDays={webinar.recurrence_days}
                  formFields={webinar.form_fields}
                  buttonLabel={webinar.capture_button_label || "Confirme sua presença"}
                  buttonColor={webinar.capture_button_color}
                  buttonTextColor={webinar.capture_button_text_color}
                />
              </div>
            </div>

            {/* ---- Imagem ---- */}
            {image && (
              <div className="overflow-hidden rounded-[18px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt=""
                  className="h-full max-h-[300px] w-full object-cover sm:max-h-[400px] lg:max-h-[560px]"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Faixa de escassez ---- */}
      {webinar.progress_bar_enabled && (
        <div className="mt-7 bg-white px-5 py-7 sm:px-10">
          <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-5 sm:flex-row sm:justify-between sm:gap-10">
            <p className="text-center text-[14px] font-bold uppercase leading-tight tracking-[-0.01em] text-[color:var(--cap-ink)] sm:text-left sm:text-[26px]">
              {scarcity}
            </p>
            <div className="w-full max-w-[420px] shrink-0">
              <div
                className="h-3 w-full overflow-hidden rounded-full bg-[#d4d7dc]"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progress}%`, background: webinar.progress_bar_color }}
                />
              </div>
              <p className="mt-2.5 text-center text-[12px] font-bold text-[color:var(--cap-ink)] sm:text-[17px]">
                {progress}% completo
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
