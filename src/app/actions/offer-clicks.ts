"use server";

import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Registra um clique no CTA da oferta (fire-and-forget a partir do player).
 * O viewer_key segue EXATAMENTE o formato do watch_sessions — assim a taxa de
 * conversão cruza cliques × plays da mesma live sem ambiguidade.
 */
export async function recordOfferClick(args: {
  webinarId: string;
  offerId?: string | null;
  registrationToken?: string | null;
  anonId?: string | null;
  sessionStartIso?: string | null;
}) {
  const { webinarId, offerId, registrationToken, anonId, sessionStartIso } = args;
  if (!webinarId || (!registrationToken && !anonId)) return;
  const supabase = supabaseAdmin();

  let viewerKey: string | null = null;
  if (registrationToken) {
    const { data: reg } = await supabase
      .from("registrations")
      .select("id")
      .eq("access_token", registrationToken)
      .single();
    if (!reg) return;
    viewerKey = sessionStartIso ? `${reg.id}:${sessionStartIso}` : reg.id;
  } else if (anonId) {
    viewerKey = sessionStartIso ? `anon:${anonId}:${sessionStartIso}` : `anon:${anonId}`;
  }
  if (!viewerKey) return;

  await supabase.from("offer_clicks").insert({
    webinar_id: webinarId,
    offer_id: offerId ?? null,
    viewer_key: viewerKey,
    session_start: sessionStartIso ?? null,
  });
}
