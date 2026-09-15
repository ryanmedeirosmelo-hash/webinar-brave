import { notFound } from "next/navigation";
import { displayTitle } from "@/components/Brand";
import { HwPage } from "@/components/HwKit";
import { SupportBox } from "@/components/SupportBox";
import { TimedOffer } from "@/components/TimedOffer";
import { supabaseAdmin } from "@/lib/supabase/server";
import { supportWhatsAppNumber } from "@/lib/whatsapp";
import type { Offer, Registration, Webinar } from "@/types/db";
import { publicLocaleFor } from "@/lib/public-locale";

// Cada página é derivada do webinar solicitado; não pode reutilizar o HTML de outro slug.
export const dynamic = "force-dynamic";

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ acesso?: string | string[] }>;
}) {
  const { slug } = await params;
  const { acesso } = await searchParams;
  const supabase = supabaseAdmin();
  const { data: webinar } = await supabase
    .from("webinars")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single<Webinar>();

  if (!webinar) notFound();

  const title = displayTitle(webinar.title);
  const locale = publicLocaleFor(webinar.language);
  const presenterName = webinar.presenter_name?.trim() || null;
  const brandName = presenterName || title;
  const requestedToken = typeof acesso === "string" ? acesso : null;
  const [{ data: registration }, { data: offers }] = await Promise.all([
    requestedToken
      ? supabase
          .from("registrations")
          .select("*")
          .eq("access_token", requestedToken)
          .eq("webinar_id", webinar.id)
          .maybeSingle<Registration>()
      : Promise.resolve({ data: null }),
    supabase
      .from("offers")
      .select("*")
      .eq("webinar_id", webinar.id)
      .order("show_at_seconds", { ascending: true }),
  ]);
  return (
    <HwPage
      logoUrl={webinar.logo_url}
      brandName={brandName}
      presenterName={presenterName}
      language={webinar.language}
    >
      <main className="relative isolate min-h-[calc(100dvh-3.5rem)] overflow-hidden px-4 py-12 sm:px-6 sm:py-20">
        <div
          aria-hidden
          className="absolute left-1/2 top-0 -z-10 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-[var(--hw-red)]/[0.07] blur-3xl"
        />

        <section className="mx-auto max-w-2xl">
          <div className="text-center">
            <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full border-8 border-[var(--hw-red)]/10 bg-white shadow-[0_18px_50px_-24px_rgba(255,0,0,0.6)]">
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="h-10 w-10 stroke-[var(--hw-red)]"
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 12 4.2 4.2L19.5 6.5" />
              </svg>
            </div>
            <p className="mt-6 inline-flex rounded-full bg-[var(--hw-red)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
              {locale === "es" ? "Finalizado" : "Encerrado"}
            </p>
            <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-[var(--hw-text)] sm:text-4xl">
              {locale === "es" ? "Esta clase ya ha finalizado." : "Esta aula já foi encerrada."}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-[16px] leading-7 text-[var(--hw-muted)]">
              {locale === "es"
                ? `Gracias por acompañar ${title}. La transmisión terminó, pero todavía puedes acceder a la oferta presentada durante la clase.`
                : `Obrigado por acompanhar ${title}. A transmissão terminou, mas você ainda pode entrar na oferta apresentada durante a aula.`}
            </p>
          </div>

          {(offers ?? []).some((offer) => !offer.disabled) && (
            <section
              id="oferta"
              aria-labelledby="offer-heading"
              className="mt-10 rounded-3xl border-2 border-[var(--hw-red)]/20 bg-[var(--hw-surface)] p-4 shadow-[0_24px_70px_-42px_rgba(255,0,0,0.6)] sm:p-5"
            >
              <div className="mb-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--hw-red)]">
                  {locale === "es" ? "Oferta disponible" : "Oferta disponível"}
                </p>
                <h2
                  id="offer-heading"
                  className="mt-1 text-xl font-bold tracking-tight text-[var(--hw-text)]"
                >
                  {locale === "es" ? "Entra ahora y asegura tu plaza" : "Entre agora e garanta sua vaga"}
                </h2>
              </div>
              <TimedOffer
                offers={(offers ?? []) as Offer[]}
                elapsed={webinar.duration_seconds - 1}
                webinarId={webinar.id}
                registrationToken={registration?.access_token ?? null}
                sessionStartIso={registration?.scheduled_start_at ?? null}
                previewMode={!registration}
                forceVisible
                stacked
                language={webinar.language}
              />
            </section>
          )}

          <div className="mt-10">
            <SupportBox
              whatsapp={supportWhatsAppNumber(webinar.integrations)}
              language={webinar.language}
            />
          </div>
        </section>
      </main>
    </HwPage>
  );
}
