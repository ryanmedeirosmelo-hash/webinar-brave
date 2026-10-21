"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { abTestSchema, type ABActionState } from "@/lib/ab-tests";
import { z } from "zod";

export async function saveABTest(_: ABActionState, form: FormData): Promise<ABActionState> {
  const token = process.env.ADMIN_SESSION_TOKEN;
  if (!token || (await cookies()).get("aw_admin")?.value !== token)
    return { error: "Sessão expirada. Entre novamente no painel." };
  let variants: unknown;
  try { variants = JSON.parse(String(form.get("variants"))); }
  catch { return { error: "Revise as variantes do teste." }; }
  const parsed = abTestSchema.safeParse({ name: form.get("name"), variants });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = String(form.get("id") ?? "");
  if (id && !z.uuid().safeParse(id).success) return { error: "Teste inválido." };
  const db = supabaseAdmin();
  const { data: webinars, error: lookupError } = await db.from("webinars").select("id, status")
    .in("id", parsed.data.variants.map(v => v.webinar_id));
  if (lookupError) return { error: "Não foi possível verificar os webinars. Tente novamente." };
  const active = form.get("active") === "on";
  if (webinars?.length !== parsed.data.variants.length)
    return { error: "Um dos webinars não existe mais. Revise as variantes." };
  if (active && parsed.data.variants.some(v => v.weight > 0 && webinars.some(w => w.id === v.webinar_id && w.status !== "active")))
    return { error: "As variantes que recebem tráfego precisam usar webinars ativos." };
  const payload = { ...parsed.data, active };
  const query = id ? db.from("webinar_ab_tests").update(payload).eq("id", id) : db.from("webinar_ab_tests").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error || !data) return { error: "Não foi possível salvar o teste. Verifique se a migração do módulo foi aplicada." };
  revalidatePath("/admin/testes-ab");
  return { success: id ? "Teste atualizado." : "Teste criado. O link está na lista abaixo." };
}
