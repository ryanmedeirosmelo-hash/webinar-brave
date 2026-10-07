import { notFound } from "next/navigation";
import { displayTitle } from "@/components/Brand";
import { HwPage } from "@/components/HwKit";
import { SupportBox } from "@/components/SupportBox";
import { ThankYouOffer } from "@/components/ThankYouOffer";
import { supabaseAdmin } from "@/lib/supabase/server";
import { supportWhatsAppNumber } from "@/lib/whatsapp";
import type { Offer, Registration, Webinar } from "@/types/db";
import { publicLocaleFor } from "@/lib/public-locale";

// Cada página é derivada do webinar solicitado; não pode reutilizar o HTML de outro slug.
export const dynamic = "force-dynamic";

const thankYouLanguageOverrides: Record<string, string> = {
  "salud-natural": "es-ES",
  "salud-natural-2": "es-ES",
  higado: "es-ES",
  "higado-2": "es-ES",
  "webinar-br-grupo": "pt-BR",
};

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
  const language = thankYouLanguageOverrides[slug] ?? webinar.language;
  const locale = publicLocaleFor(language);
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
      language={language}
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
            <ThankYouOffer
              slug={webinar.slug}
              offers={(offers ?? []) as Offer[]}
              webinarId={webinar.id}
              registrationToken={registration?.access_token ?? null}
              sessionStartIso={registration?.scheduled_start_at ?? null}
              previewMode={!registration}
              language={language}
            />
          )}

          <div className="mt-10">
            <SupportBox
              whatsapp={supportWhatsAppNumber(webinar.integrations)}
              language={language}
            />
          </div>
        </section>
      </main>
    </HwPage>
  );
}
