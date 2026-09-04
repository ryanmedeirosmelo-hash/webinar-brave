import { supabaseAdmin } from "@/lib/supabase/server";
import { nextSessionStart } from "@/lib/time";
import type { ChatMessage, Offer, SalesNotification, Webinar } from "@/types/db";

export type PublicWebinarRoomData = {
  webinar: Webinar;
  messages: ChatMessage[];
  offers: Offer[];
  sales: SalesNotification[];
};

/** Webinars únicos ativos que podem ser expostos pelos links públicos do painel. */
export async function getActiveSingleWebinar(slug: string): Promise<Webinar | null> {
  const { data } = await supabaseAdmin()
    .from("webinars")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .eq("type", "unico")
    .maybeSingle<Webinar>();

  return data ?? null;
}

/** Dados da sala pública, compartilhados entre a espera e a transmissão. */
export async function getActiveSingleWebinarRoom(
  slug: string
): Promise<PublicWebinarRoomData | null> {
  const webinar = await getActiveSingleWebinar(slug);
  if (!webinar) return null;

  const supabase = supabaseAdmin();
  const [{ data: messages }, { data: offers }, { data: sales }] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*")
      .eq("webinar_id", webinar.id)
      .order("at_seconds", { ascending: true }),
    supabase
      .from("offers")
      .select("*")
      .eq("webinar_id", webinar.id)
      .order("show_at_seconds", { ascending: true }),
    supabase
      .from("sales_notifications")
      .select("*")
      .eq("webinar_id", webinar.id)
      .order("at_seconds", { ascending: true }),
  ]);

  return {
    webinar,
    messages: (messages ?? []) as ChatMessage[],
    offers: (offers ?? []) as Offer[],
    sales: (sales ?? []) as SalesNotification[],
  };
}

/**
 * O webinar único respeita sua data real. O fallback mantém a sala utilizável
 * para webinars legados que ainda não receberam uma data no painel.
 */
export function singleWebinarStartAt(webinar: Webinar): string {
  if (webinar.start_at && !Number.isNaN(new Date(webinar.start_at).getTime())) {
    return webinar.start_at;
  }
  return nextSessionStart(webinar).toISOString();
}

export function isSingleWebinarLive(webinar: Webinar, nowMs = Date.now()): boolean {
  const startMs = new Date(singleWebinarStartAt(webinar)).getTime();
  const endMs = startMs + Math.max(0, webinar.duration_seconds) * 1_000;
  return nowMs >= startMs && nowMs < endMs;
}
