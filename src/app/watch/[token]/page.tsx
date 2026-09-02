import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LivePlayer } from "@/components/LivePlayer";
import { displayTitle } from "@/components/Brand";
import { resolveVideoUrl } from "@/lib/video-source";
import { supportWhatsAppNumber } from "@/lib/whatsapp";
import type { Webinar, Registration, ChatMessage, Offer, SalesNotification } from "@/types/db";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  const { preview } = await searchParams;
  const previewMode = preview === "1" || preview === "true";
  const supabase = supabaseAdmin();

  const { data: registration } = await supabase
    .from("registrations")
    .select("*")
    .eq("access_token", token)
    .single<Registration>();

  if (!registration) notFound();

  const viewerKey = `${registration.id}:${registration.scheduled_start_at}`;
  const [{ data: webinar }, { data: messages }, { data: offers }, { data: sales }, { data: watchSession }] =
    await Promise.all([
      supabase
        .from("webinars")
        .select("*")
        .eq("id", registration.webinar_id)
        .single<Webinar>(),
      supabase
        .from("chat_messages")
        .select("*")
        .eq("webinar_id", registration.webinar_id)
        .order("at_seconds", { ascending: true }),
      supabase
        .from("offers")
        .select("*")
        .eq("webinar_id", registration.webinar_id)
        .order("show_at_seconds", { ascending: true }),
      supabase
        .from("sales_notifications")
        .select("*")
        .eq("webinar_id", registration.webinar_id)
        .order("at_seconds", { ascending: true }),
      supabase
        .from("watch_sessions")
        .select("last_position_seconds")
        .eq("viewer_key", viewerKey)
        .maybeSingle<{ last_position_seconds: number | null }>(),
    ]);

  if (!webinar) notFound();

  const videoUrl = resolveVideoUrl(webinar);

  return (
    <main className="min-h-full">
      <LivePlayer
        title={webinar.title}
        presenterName={webinar.presenter_name}
        brandName={webinar.presenter_name || displayTitle(webinar.title)}
        logoUrl={webinar.logo_url}
        accentColor={webinar.capture_button_color}
        videoUrl={videoUrl}
        durationSeconds={webinar.duration_seconds}
        scheduledStartAtIso={registration.scheduled_start_at}
        timezone={webinar.timezone}
        messages={(messages ?? []) as ChatMessage[]}
        offers={(offers ?? []) as Offer[]}
        sales={(sales ?? []) as SalesNotification[]}
        salesTitle={webinar.sales_notification_title}
        autoplay={webinar.video_autoplay}
        fullscreen={webinar.video_fullscreen}
        audience={{
          enabled: webinar.audience_enabled,
          mode: webinar.audience_mode,
          min: webinar.audience_min,
          max: webinar.audience_max,
        }}
        registrationToken={token}
        initialResumeSeconds={
          webinar.resume_progress_enabled ? Math.max(0, watchSession?.last_position_seconds ?? 0) : 0
        }
        hasStarted={webinar.resume_progress_enabled && !!watchSession}
        resumeProgressEnabled={webinar.resume_progress_enabled}
        webinarId={webinar.id}
        viewerName={registration.name}
        supportWhatsapp={supportWhatsAppNumber(webinar.integrations)}
        previewMode={previewMode}
      />
    </main>
  );
}
