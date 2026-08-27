"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { registrationSchema } from "@/lib/schemas";
import { buildScheduledStartAt, isoWeekday, REGISTRATION_LEAD_MS } from "@/lib/time";

export type RegistrationState = { error?: string } | undefined;

type WebinarRow = {
  id: string;
  timezone: string;
  status: string;
  type: string;
  duration_seconds: number;
  recurrence_enabled: boolean;
  recurrence_freq: string;
  recurrence_days: number[] | null;
  available_times: string[] | null;
};

const WEBINAR_COLS =
  "id, timezone, status, type, duration_seconds, recurrence_enabled, recurrence_freq, recurrence_days, available_times";

function isWeekly(w: WebinarRow): boolean {
  return (
    w.recurrence_enabled &&
    w.recurrence_freq === "weekly" &&
    (w.recurrence_days?.length ?? 0) > 0
  );
}

/**
 * Valida se a sessão (date+time) é elegível pra inscrição neste webinar.
 * `enforceLeadWindow` liga a regra "cadastro só abre 8h antes" (fluxo recorrente).
 * Retorna a mensagem de erro, ou null se estiver tudo certo.
 */
function validateSession(
  w: WebinarRow,
  date: string,
  time: string,
  scheduledStartAt: Date,
  enforceLeadWindow: boolean
): string | null {
  const now = Date.now();
  const startMs = scheduledStartAt.getTime();
  const elapsed = (now - startMs) / 1000;

  // Recorrência semanal tem prioridade sobre o tipo: garante a janela de 8h
  // mesmo que o webinar também esteja marcado como just_in_time.
  if (isWeekly(w)) {
    if (!(w.recurrence_days ?? []).includes(isoWeekday(date))) {
      return "Escolha um dia em que a aula acontece.";
    }
    if (!(w.available_times ?? []).includes(time)) {
      return "Escolha um horário válido da aula.";
    }
    if (elapsed >= w.duration_seconds) {
      return "Esta sessão já foi encerrada. Escolha a próxima.";
    }
    // "Cadastro abre 8h antes": antes da janela não deixa inscrever.
    if (enforceLeadWindow && now < startMs - REGISTRATION_LEAD_MS) {
      return "As inscrições para esta aula ainda não abriram.";
    }
    return null;
  }

  if (w.type === "just_in_time") {
    if (elapsed >= w.duration_seconds) {
      return "Esta sessão já foi encerrada. Escolha o próximo horário.";
    }
    return null;
  }

  // Webinar único: só horário no futuro (margem de 60s pra fuso/relógio).
  if (elapsed > 60) return "Escolha um horário no futuro.";
  return null;
}

/**
 * Cria a inscrição (form de marketing clássico): valida, insere e redireciona
 * pra /watch/<access_token>.
 */
export async function createRegistration(
  _prev: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  const parsed = registrationSchema.safeParse({
    webinarId: formData.get("webinarId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    date: formData.get("date"),
    time: formData.get("time"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { webinarId, name, email, phone, date, time } = parsed.data;
  const supabase = supabaseAdmin();

  const { data: webinar, error: wErr } = await supabase
    .from("webinars")
    .select(WEBINAR_COLS)
    .eq("id", webinarId)
    .single<WebinarRow>();

  if (wErr || !webinar || webinar.status !== "active") {
    return { error: "Webinar indisponível." };
  }

  const scheduledStartAt = buildScheduledStartAt(date, time, webinar.timezone);
  const err = validateSession(webinar, date, time, scheduledStartAt, false);
  if (err) return { error: err };

  const { data: reg, error: rErr } = await supabase
    .from("registrations")
    .insert({
      webinar_id: webinar.id,
      name,
      email,
      phone: phone || null,
      scheduled_start_at: scheduledStartAt.toISOString(),
      timezone: webinar.timezone,
    })
    .select("access_token")
    .single();

  if (rErr || !reg) {
    return { error: "Não foi possível concluir a inscrição. Tente de novo." };
  }

  redirect(`/watch/${reg.access_token}`);
}

export type RegisterResult =
  | { ok: true; token: string; scheduledStartAtIso: string }
  | { ok: false; error: string };

/**
 * Inscrição do fluxo RECORRENTE (aula-seg/aula-qui): exige nome+email+telefone,
 * respeita a janela de 8h, e RETORNA o token (sem redirect) pro navegador
 * guardar em cache e cair direto na sala. Idempotente por (webinar, email,
 * sessão): se a pessoa já está inscrita naquela sessão, devolve o mesmo token —
 * assim o "re-cadastro silencioso" toda semana não duplica leads.
 */
export async function registerForSession(input: {
  webinarId: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
}): Promise<RegisterResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const phone = (parsed.data.phone ?? "").trim();
  if (phone.replace(/\D/g, "").length < 8) {
    return { ok: false, error: "Informe um telefone válido com DDD." };
  }

  const { webinarId, name, email, date, time } = parsed.data;
  const supabase = supabaseAdmin();

  const { data: webinar, error: wErr } = await supabase
    .from("webinars")
    .select(WEBINAR_COLS)
    .eq("id", webinarId)
    .single<WebinarRow>();

  if (wErr || !webinar || webinar.status !== "active") {
    return { ok: false, error: "Webinar indisponível." };
  }

  const scheduledStartAt = buildScheduledStartAt(date, time, webinar.timezone);
  const iso = scheduledStartAt.toISOString();
  const err = validateSession(webinar, date, time, scheduledStartAt, true);
  if (err) return { ok: false, error: err };

  // Idempotência: mesma pessoa + mesma sessão → reaproveita a inscrição.
  const { data: existing } = await supabase
    .from("registrations")
    .select("access_token")
    .eq("webinar_id", webinar.id)
    .eq("email", email)
    .eq("scheduled_start_at", iso)
    .limit(1)
    .maybeSingle();

  if (existing?.access_token) {
    return { ok: true, token: existing.access_token, scheduledStartAtIso: iso };
  }

  const { data: reg, error: rErr } = await supabase
    .from("registrations")
    .insert({
      webinar_id: webinar.id,
      name,
      email,
      phone,
      scheduled_start_at: iso,
      timezone: webinar.timezone,
    })
    .select("access_token")
    .single();

  if (rErr || !reg) {
    return { ok: false, error: "Não foi possível concluir a inscrição. Tente de novo." };
  }

  return { ok: true, token: reg.access_token, scheduledStartAtIso: iso };
}
