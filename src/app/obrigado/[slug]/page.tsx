import Link from "next/link";
import { notFound } from "next/navigation";
import { displayTitle } from "@/components/Brand";
import { HwAvatar, HwPage } from "@/components/HwKit";
import { SupportBox } from "@/components/SupportBox";
import { supabaseAdmin } from "@/lib/supabase/server";
import { supportWhatsAppNumber } from "@/lib/whatsapp";
import type { Webinar } from "@/types/db";

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
  const { data: webinar } = await supabaseAdmin()
    .from("webinars")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single<Webinar>();

  if (!webinar) notFound();

  const title = displayTitle(webinar.title);
  const presenterName = webinar.presenter_name?.trim() || null;
  const brandName = presenterName || title;
  const accessToken = typeof acesso === "string" ? acesso : null;

  return (
    <HwPage
      logoUrl={webinar.logo_url}
      brandName={brandName}
      presenterName={presenterName}
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
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--hw-red)]">
              Tudo certo
            </p>
            <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-[var(--hw-text)] sm:text-4xl">
              Seu lugar em {title} está reservado.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-[16px] leading-7 text-[var(--hw-muted)]">
              {webinar.description?.trim() ||
                "Obrigado por se inscrever. Guarde este momento: em breve você receberá as orientações para acompanhar a aula."}
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-3xl border border-[var(--hw-border)] bg-[var(--hw-surface)] shadow-[0_24px_70px_-42px_rgba(15,23,42,0.42)]">
            <div className="border-b border-[var(--hw-border)] bg-[var(--hw-bg-soft)] px-6 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--hw-red)]">
                Próximo passo
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--hw-text)]">
                Fique de olho no seu e-mail.
              </h2>
            </div>
            <div className="space-y-6 px-6 py-6">
              <p className="text-[15px] leading-6 text-[var(--hw-muted)]">
                Enviaremos o acesso e os próximos avisos por lá. Enquanto isso, você pode voltar à
                página do webinar quando quiser.
              </p>

              {presenterName && (
                <div className="flex items-center gap-3 rounded-2xl bg-[var(--hw-bg-soft)] p-3">
                  <HwAvatar
                    name={presenterName}
                    size={40}
                    presenterName={presenterName}
                    presenterAvatarUrl={webinar.presenter_avatar_url}
                  />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--hw-muted)]">
                      Sua aula será conduzida por
                    </p>
                    <p className="font-semibold text-[var(--hw-text)]">{presenterName}</p>
                  </div>
                </div>
              )}

              <Link
                href={accessToken ? `/watch/${encodeURIComponent(accessToken)}` : `/${webinar.slug}`}
                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--hw-red)] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--hw-red-hover)] active:scale-[0.99]"
              >
                {accessToken ? "Acessar minha aula" : "Ver página do webinar"}
              </Link>
            </div>
          </div>

          <div className="mt-5">
            <SupportBox whatsapp={supportWhatsAppNumber(webinar.integrations)} />
          </div>
        </section>
      </main>
    </HwPage>
  );
}
