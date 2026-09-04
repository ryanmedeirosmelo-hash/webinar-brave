import { LivePlayer } from "@/components/LivePlayer";
import { displayTitle } from "@/components/Brand";
import { resolveVideoUrl } from "@/lib/video-source";
import { supportWhatsAppNumber } from "@/lib/whatsapp";
import type { PublicWebinarRoomData } from "@/lib/public-webinar";

type Props = PublicWebinarRoomData & {
  scheduledStartAtIso: string;
};

/** Sala pública sem cadastro: o LivePlayer grava presença anônima por navegador. */
export function PublicWebinarRoom({
  webinar,
  messages,
  offers,
  sales,
  scheduledStartAtIso,
}: Props) {
  return (
    <main className="min-h-full">
      <LivePlayer
        title={webinar.title}
        presenterName={webinar.presenter_name}
        presenterAvatarUrl={webinar.presenter_avatar_url}
        brandName={webinar.presenter_name || displayTitle(webinar.title)}
        logoUrl={webinar.logo_url}
        accentColor={webinar.capture_button_color}
        webinarId={webinar.id}
        supportWhatsapp={supportWhatsAppNumber(webinar.integrations)}
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
        resumeProgressEnabled={webinar.resume_progress_enabled}
        thankYouPath={`/obrigado/${webinar.slug}`}
      />
    </main>
  );
}
