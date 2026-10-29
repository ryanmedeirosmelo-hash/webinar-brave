"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { LiveDashboardData, LiveSnapshot } from "@/lib/live-metrics";

export async function getLiveDashboard(kind: "webinar" | "test", id: string): Promise<LiveDashboardData | null> {
  const token = process.env.ADMIN_SESSION_TOKEN;
  if (!token || (await cookies()).get("aw_admin")?.value !== token) throw new Error("Sessão expirada. Entre novamente no painel.");
  if (!z.uuid().safeParse(id).success || !["webinar", "test"].includes(kind)) return null;
  const db = supabaseAdmin();
  if (kind === "test") {
    const { data, error } = await db.rpc("webinar_ab_live_snapshot", { p_test_id: id });
    if (error) throw new Error("Não foi possível atualizar as métricas do teste.");
    return data as LiveDashboardData | null;
  }
  const { data: exists, error: lookupError } = await db.from("webinars").select("id").eq("id", id).maybeSingle();
  if (lookupError) throw new Error("Não foi possível carregar o webinar.");
  if (!exists) return null;
  const { data, error } = await db.rpc("webinar_live_snapshot", { p_webinar_id: id });
  if (error) throw new Error("Não foi possível atualizar as métricas do webinar.");
  const snapshot = data as LiveSnapshot;
  return { id, kind, title: snapshot.title || "Webinar", updated_at: snapshot.updated_at, variants: [snapshot] };
}
