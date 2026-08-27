import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SignupForm } from "@/components/SignupForm";
import { LivePlayer } from "@/components/LivePlayer";
import { RegisterGate } from "@/components/RegisterGate";
import { nextSessionStart } from "@/lib/time";
import { displayTitle } from "@/components/Brand";
import { resolveVideoUrl } from "@/lib/video-source";
import type { Webinar, ChatMessage, Offer, SalesNotification } from "@/types/db";

// Sala de espera = contagem regressiva: precisa renderizar a cada acesso
// (senão o Next cacheia o HTML e congela o horário do build → "encerrada").
export const dynamic = "force-dynamic";

type RoomChildren = { messages: ChatMessage[]; offers: Offer[]; sales: SalesNotification[] };

/** Busca chat/ofertas/vendas do webinar (sala e gate usam os mesmos dados). */
async function fetchRoomChildren(
  supabase: ReturnType<typeof supabaseAdmin>,
  webinarId: string
): Promise<RoomChildren> {
  const [{ data: messages }, { data: offers }, { data: sales }] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*")
      .eq("webinar_id", webinarId)
      .order("at_seconds", { ascending: true }),
    supabase
      .from("offers")
      .select("*")
      .eq("webinar_id", webinarId)
      .order("show_at_seconds", { ascending: true }),
    supabase
      .from("sales_notifications")
      .select("*")
      .eq("webinar_id", webinarId)
      .order("at_seconds", { ascending: true }),
  ]);
  return {
    messages: (messages ?? []) as ChatMessage[],
    offers: (offers ?? []) as Offer[],
    sales: (sales ?? []) as SalesNotification[],
  };
}

export default async function WebinarLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = supabaseAdmin();

  const { data: webinar } = await supabase
    .from("webinars")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single<Webinar>();

  if (!webinar) notFound();

  // Fluxo RECORRENTE (aula-seg/aula-qui): exige cadastro (nome/email/telefone) pra
  // entrar, abre 8h antes, e guarda cache pra cair direto na sala nas próximas
  // semanas. Tem prioridade sobre o modo landing.
  const isWeekly =
    webinar.recurrence_enabled &&
    webinar.recurrence_freq === "weekly" &&
    (webinar.recurrence_days?.length ?? 0) > 0;

  if (isWeekly) {
    const { messages, offers, sales } = await fetchRoomChildren(supabase, webinar.id);
    return (
      <main className="min-h-full">
        <RegisterGate
          webinar={webinar}
          videoUrl={resolveVideoUrl(webinar)}
          messages={messages}
          offers={offers}
          sales={sales}
        />
      </main>
    );
  }

  // Modo "sala de espera": a própria landing vira contagem regressiva + player,
  // sem formulário de inscrição. No horário, troca pro vídeo inline (igual /watch).
  // Liga em: Admin → etapa Espera → Página de espera = "Landing Page personalizada".
  if (webinar.waiting_room_page === "landing") {
    const { messages, offers, sales } = await fetchRoomChildren(supabase, webinar.id);
    // Sem inscrito: o servidor decide o próximo início (JIT → próximo intervalo).
    const scheduledStartAtIso = nextSessionStart(webinar).toISOString();

    return (
      <main className="min-h-full">
        <LivePlayer
          title={webinar.title}
          presenterName={webinar.presenter_name}
          brandName={webinar.presenter_name || displayTitle(webinar.title)}
          logoUrl={webinar.logo_url}
          accentColor={webinar.capture_button_color}
          webinarId={webinar.id}
          videoUrl={resolveVideoUrl(webinar)}
          durationSeconds={webinar.duration_seconds}
          scheduledStartAtIso={scheduledStartAtIso}
          timezone={webinar.timezone}
          messages={messages}
          offers={offers}
          sales={sales}
          salesTitle={webinar.sales_notification_title}
          autoplay={webinar.video_autoplay}
          fullscreen={webinar.video_fullscreen}
          audience={{
            enabled: webinar.audience_enabled,
            mode: webinar.audience_mode,
            min: webinar.audience_min,
            max: webinar.audience_max,
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-full grid lg:grid-cols-2">
      {/* Coluna de apresentação */}
      <section className="flex flex-col justify-center gap-6 px-8 py-16 lg:px-16 bg-gradient-to-br from-slate-900 to-slate-950">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-red-500/15 px-3 py-1 text-sm font-medium text-red-300">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Aula ao vivo
        </span>
        <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
          {displayTitle(webinar.title)}
        </h1>
        {webinar.description && (
          <p className="text-lg text-slate-300 max-w-md">{webinar.description}</p>
        )}
        <ul className="space-y-2 text-slate-300">
          <li>✅ Conteúdo exclusivo, ao vivo</li>
          <li>✅ Oferta especial liberada só durante a transmissão</li>
          <li>✅ Tire dúvidas no chat com os participantes</li>
        </ul>
      </section>

      {/* Coluna do formulário */}
      <section className="flex flex-col justify-center px-8 py-16 lg:px-16 bg-slate-950">
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-white mb-1">Garanta sua vaga</h2>
          <p className="text-slate-400 mb-6">Escolha o melhor dia e horário pra você.</p>
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
          />
        </div>
      </section>
    </main>
  );
}
