"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { buildLeadWebhookDelivery, type LeadSource } from "@/lib/lead-webhook";
import { supabaseAdmin } from "@/lib/supabase/server";
import { registrationSchema } from "@/lib/schemas";
import {
  buildScheduledStartAt,
  isoWeekday,
  jitSlots,
  recurrenceSlots,
  REGISTRATION_LEAD_MS,
} from "@/lib/time";
import type { FormField } from "@/types/db";

export type RegistrationState = { error?: string } | undefined;

type WebinarRow = {
  id: string;
  timezone: string;
  status: string;
  type: string;
  jit_interval_minutes: number;
  duration_seconds: number;
  recurrence_enabled: boolean;
  recurrence_freq: string;
  recurrence_days: number[] | null;
  available_times: string[] | null;
  form_fields: FormField[] | null;
  integrations: Record<string, unknown> | null;
};

type StoredRegistration = { access_token: string; created_at: string };

const WEBINAR_COLS =
  "id, timezone, status, type, jit_interval_minutes, duration_seconds, recurrence_enabled, recurrence_freq, recurrence_days, available_times, form_fields, integrations";

function sourceText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 2_000) : "";
}

function forwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

async function sessionUrl(accessToken: string) {
  const requestHeaders = await headers();
  const host =
    forwardedValue(requestHeaders.get("x-forwarded-host")) ||
    forwardedValue(requestHeaders.get("host"));
  const requestedProtocol = forwardedValue(requestHeaders.get("x-forwarded-proto"));
  const protocol = requestedProtocol === "http" ? "http" : "https";

  try {
    return new URL(`/watch/${accessToken}`, `${protocol}://${host}`).toString();
  } catch {
    // Só ocorre em ambientes sem host HTTP válido. A inscrição permanece
    // íntegra e o webhook recebe um valor vazio em vez de um link incorreto.
    return "";
  }
}

async function leadSource(input: LeadSource): Promise<LeadSource> {
  const requestHeaders = await headers();
  return {
    origin:
      sourceText(input.origin) ||
      requestHeaders.get("referer") ||
      requestHeaders.get("origin") ||
      "",
    referrer: sourceText(input.referrer),
    userAgent: sourceText(input.userAgent) || requestHeaders.get("user-agent") || "",
  };
}

function whatsappIsRequired(w: WebinarRow) {
  return w.form_fields?.some(
    (field) => field.key === "whatsapp" && field.enabled && field.required
  );
}

function isWeekly(w: WebinarRow): boolean {
  return (
    w.type !== "just_in_time" &&
    w.recurrence_enabled &&
    w.recurrence_freq === "weekly" &&
    (w.recurrence_days?.length ?? 0) > 0
  );
}

/**
 * Insere a inscrição e a entrega de webhook como uma única operação do banco.
 * O token é criado antes para que o payload já carregue o link final da sala.
 */
async function storeRegistration(
  webinar: WebinarRow,
  registration: {
    name: string;
    email: string;
    phone: string | null;
    scheduledStartAt: Date;
  },
  source: LeadSource
) {
  const accessToken = randomUUID();
  const createdAt = new Date().toISOString();
  const registeredSessionUrl = await sessionUrl(accessToken);
  const delivery = buildLeadWebhookDelivery(
    webinar,
    {
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
      scheduledStartAt: registration.scheduledStartAt.toISOString(),
      createdAt,
      sessionUrl: registeredSessionUrl,
    },
    source
  );

  return supabaseAdmin()
    .rpc("create_registration_with_webhook_delivery", {
      p_webinar_id: webinar.id,
      p_name: registration.name,
      p_email: registration.email,
      p_phone: registration.phone,
      p_scheduled_start_at: registration.scheduledStartAt.toISOString(),
      p_timezone: webinar.timezone,
      p_access_token: accessToken,
      p_created_at: createdAt,
      p_webhook_url: delivery?.targetUrl ?? null,
      p_webhook_payload: delivery?.payload ?? null,
    })
    .single<StoredRegistration>();
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
  enforceLeadWindow: boolean,
  requireFutureSession = false
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
    if (requireFutureSession && elapsed >= 0) {
      return "Este horário já passou. Escolha o próximo.";
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
    // Além da próxima janela, aceita a sessão que acabou de começar enquanto
    // ela ainda está ao vivo. Assim um clique na virada do minuto não falha e
    // o lead é levado direto à transmissão em vez de precisar se cadastrar de
    // novo para o minuto seguinte.
    const jitCandidates = jitSlots({
      intervalMinutes: Math.max(1, Math.floor(w.jit_interval_minutes || 15)),
      durationSeconds: w.duration_seconds,
      timezone: w.timezone,
      nowMs: now,
      upcoming: 1,
    });
    const fixedCandidates = recurrenceSlots({
      times: w.available_times ?? [],
      days: [1, 2, 3, 4, 5, 6, 7],
      durationSeconds: w.duration_seconds,
      timezone: w.timezone,
      nowMs: now,
      upcoming: 1,
    });
    const isAllowedSession = [...jitCandidates, ...fixedCandidates].some((slot) => slot.startMs === startMs);
    if (!isAllowedSession) {
      return "Escolha o próximo horário disponível ou a sessão das 20h.";
    }
    if (elapsed >= w.duration_seconds) {
      return "Esta sessão já foi encerrada. Escolha o próximo horário.";
    }
    return null;
  }

  // Webinar único: só horário no futuro (margem de 60s pra fuso/relógio).
  if (requireFutureSession && elapsed >= 0) return "Este horário já passou.";
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
    // O formulário público padrão não coleta telefone. FormData.get() devolve
    // null para campos ausentes, enquanto o schema aceita o campo opcional como
    // string ou undefined.
    phone: formData.get("phone") ?? undefined,
    date: formData.get("date"),
    time: formData.get("time"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { webinarId, name, email, phone, date, time } = parsed.data;
  const source = await leadSource({
    origin: formData.get("origin")?.toString(),
    referrer: formData.get("referrer")?.toString(),
    userAgent: formData.get("user_agent")?.toString(),
  });
  const supabase = supabaseAdmin();

  const { data: webinar, error: wErr } = await supabase
    .from("webinars")
    .select(WEBINAR_COLS)
    .eq("id", webinarId)
    .single<WebinarRow>();

  if (wErr || !webinar || webinar.status !== "active") {
    return { error: "Webinar indisponível." };
  }

  if (whatsappIsRequired(webinar) && (phone ?? "").replace(/\D/g, "").length < 8) {
    return { error: "Informe seu WhatsApp válido com DDD." };
  }

  const scheduledStartAt = buildScheduledStartAt(date, time, webinar.timezone);
  const err = validateSession(webinar, date, time, scheduledStartAt, false, true);
  if (err) return { error: err };

  // Idempotência: mesma pessoa + mesma sessão → reaproveita a inscrição, como o
  // fluxo recorrente já faz. No celular o envio duplicado é rotina — a pessoa
  // toca, a rede demora, a tela não muda e ela toca de novo. Sem isso, cada
  // toque virava um lead novo, um token novo e mais um disparo de WhatsApp.
  const { data: existing } = await supabase
    .from("registrations")
    .select("access_token")
    .eq("webinar_id", webinar.id)
    .eq("email", email)
    .eq("scheduled_start_at", scheduledStartAt.toISOString())
    .limit(1)
    .maybeSingle<{ access_token: string }>();

  if (existing?.access_token) redirect(`/watch/${existing.access_token}`);

  const { data: reg, error: rErr } = await storeRegistration(
    webinar,
    { name, email, phone: phone || null, scheduledStartAt },
    source
  );

  if (rErr || !reg) {
    return { error: "Não foi possível concluir a inscrição. Tente de novo." };
  }

  // Antes da aula, a pessoa segue direto para a sala: ela mostra a contagem
  // regressiva até o horário marcado. A página final só aparece após o término.
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
  origin?: string;
  referrer?: string;
  userAgent?: string;
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
  const source = await leadSource(input);
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

  const { data: reg, error: rErr } = await storeRegistration(
    webinar,
    { name, email, phone, scheduledStartAt },
    source
  );

  if (rErr || !reg) {
    return { ok: false, error: "Não foi possível concluir a inscrição. Tente de novo." };
  }

  return { ok: true, token: reg.access_token, scheduledStartAtIso: iso };
}
