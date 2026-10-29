import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Cookies identify test enrollments; SQL verifies each enrollment matches this webinar. */
export async function attributeAB(webinarId: string, context: { viewerKey?: string; registrationToken?: string }) {
  try {
    const visitors = (await cookies()).getAll().flatMap(cookie => {
      const match = /^ab_([0-9a-f-]{36})$/.exec(cookie.name);
      return match && z.uuid().safeParse(match[1]).success && z.uuid().safeParse(cookie.value).success
        ? [{ test_id: match[1], visitor_id: cookie.value }] : [];
    }).slice(0, 64);
    if (!visitors.length) return;
    const { error } = await supabaseAdmin().rpc("attribute_webinar_ab", {
      p_webinar_id: webinarId, p_visitors: visitors,
      p_viewer_key: context.viewerKey ?? null, p_registration_token: context.registrationToken ?? null,
    });
    if (error) console.error("AB attribution failed", error.code);
  } catch { console.error("AB attribution unavailable"); }
}
