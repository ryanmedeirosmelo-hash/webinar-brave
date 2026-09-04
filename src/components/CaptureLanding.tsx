import { SignupForm } from "@/components/SignupForm";
import { displayTitle } from "@/components/Brand";
import { paragraphs, richText } from "@/lib/rich-text";
import type { Webinar } from "@/types/db";

/**
 * Página de captura: uma sala de inscrição clara em um campo verde vivo.
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
    <div className="cap-theme min-h-full py-4 sm:py-10 lg:py-12">
      <div className="mx-auto w-full max-w-[1240px] px-3 sm:px-5">
        <div className="cap-shell overflow-hidden rounded-[28px] bg-[color:var(--cap-surface)] shadow-[0_32px_80px_-34px_rgba(2,77,35,0.72)] sm:rounded-[34px]">
          <div className={`grid ${image ? "lg:grid-cols-[minmax(0,1.12fr)_minmax(330px,0.88fr)]" : ""}`}>
            {/* ---- Conteúdo e inscrição ---- */}
            <div className="min-w-0 px-5 py-7 sm:px-10 sm:py-11 lg:px-12 lg:py-12">
              <div className="max-w-[620px]">
                {webinar.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={webinar.logo_url} alt="" className="mb-6 h-10 w-auto max-w-[220px] object-contain sm:mb-8" />
                )}

                <p className="cap-kicker">
                  <span aria-hidden="true" />
                  Inscrição gratuita
                </p>

                <h1 className="mt-4 font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.045em] text-[color:var(--cap-ink)] sm:mt-5 sm:text-[45px] lg:text-[48px]">
                  {richText(heading)}
                </h1>

                {body && (
                  <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
                    {paragraphs(body).map((p, i) => (
                      <p key={i} className="text-[15px] leading-[1.55] text-[color:var(--cap-muted)] sm:text-[17px] sm:leading-[1.6]">
                        {richText(p)}
                      </p>
                    ))}
                  </div>
                )}

                <div className="cap-form-panel mt-7 rounded-[20px] p-4 sm:mt-8 sm:rounded-[22px] sm:p-6">
                  <p className="mb-4 text-[13px] font-bold text-[color:var(--cap-ink)] sm:mb-5 sm:text-[15px]">
                    Escolha seu horário e reserve sua vaga
                  </p>
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
            </div>

            {/* ---- Imagem ---- */}
            {image && (
              <div className="cap-image-panel relative min-h-[260px] overflow-hidden lg:min-h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,70,34,0.04)_30%,rgba(5,70,34,0.42)_100%)]" />
              </div>
            )}
          </div>

          {/* ---- Faixa de escassez ---- */}
          {webinar.progress_bar_enabled && (
            <div className="cap-scarcity border-t border-[color:var(--cap-rule)] px-5 py-5 sm:px-10 sm:py-6 lg:px-12">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:gap-10">
                <p className="text-center text-[14px] font-bold leading-tight tracking-[-0.015em] text-[color:var(--cap-ink)] sm:text-left sm:text-[18px]">
                  {scarcity}
                </p>
                <div className="w-full max-w-[390px] shrink-0">
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--cap-progress-track)]"
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
                  <p className="mt-2 text-center text-[12px] font-bold text-[color:var(--cap-muted)]">{progress}% completo</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
