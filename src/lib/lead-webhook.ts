import "server-only";

import { zonedParts } from "@/lib/time";

type WebinarWebhookConfig = {
  type: string;
  timezone: string;
  integrations: Record<string, unknown> | null;
};

type LeadRegistration = {
  name: string;
  email: string;
  phone: string | null;
  scheduledStartAt: string;
  createdAt: string;
  sessionUrl: string;
};

export type LeadSource = {
  origin?: string;
  referrer?: string;
  userAgent?: string;
};

type WebhookConfig = { enabled?: unknown; value?: unknown };

const KNOWN_DDIS = ["351", "61", "55", "44", "34", "1"];
const MAX_SOURCE_LENGTH = 2_000;
const WEBHOOK_TIMEOUT_MS = 4_000;

function text(value: unknown, max = MAX_SOURCE_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function configuredWebhookUrl(integrations: Record<string, unknown> | null): string | null {
  const raw = integrations?.webhook;
  if (!raw || typeof raw !== "object") return null;

  const config = raw as WebhookConfig;
  if (config.enabled !== true || typeof config.value !== "string") return null;

  try {
    const url = new URL(config.value);
    // A URL vem do painel administrativo. Ainda assim, só permitimos HTTPS e
    // recusamos redirects para não transformar a integração em um vetor de SSRF.
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function phoneFields(value: string | null) {
  const raw = (value ?? "").replace(/\D/g, "");
  if (!raw) {
    return { telefone: "", telefone_full: "", ddi: "55", whatsapp: "" };
  }

  const ddi = KNOWN_DDIS.find((code) => raw.startsWith(code)) ?? "55";
  const full = raw.startsWith(ddi) ? raw : `${ddi}${raw}`;

  return {
    telefone: full.slice(ddi.length),
    telefone_full: full,
    ddi,
    whatsapp: full ? `+${full}` : "",
  };
}

function aulaLabel(startMs: number, timezone: string) {
  const { date, time } = zonedParts(startMs, timezone);
  const today = zonedParts(Date.now(), timezone).date;
  const tomorrow = zonedParts(Date.now() + 86_400_000, timezone).date;
  const hour = time.replace(":", "h");

  if (date === today) return `Hoje às ${hour}`;
  if (date === tomorrow) return `Amanhã às ${hour}`;

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year} às ${hour}`;
}

function turma(startMs: number, webinar: WebinarWebhookConfig) {
  const time = zonedParts(startMs, webinar.timezone).time.replace(":", "h");
  return webinar.type === "just_in_time" ? `just_in_time_${time}` : `fixa_${time}`;
}

/**
 * Monta o mesmo contrato de lead que o fluxo anterior do n8n/WordPress usa.
 * O POST acontece no servidor depois que a inscrição já foi persistida.
 */
export function buildLeadWebhookPayload(
  webinar: WebinarWebhookConfig,
  registration: LeadRegistration,
  source: LeadSource
) {
  const startMs = new Date(registration.scheduledStartAt).getTime();
  const phone = phoneFields(registration.phone);

  return {
    origem: text(source.origin),
    referrer: text(source.referrer),
    user_agent: text(source.userAgent),
    nome: registration.name,
    email: registration.email,
    ...phone,
    aula: new Date(startMs).toISOString(),
    aula_ts: String(startMs),
    aula_label: aulaLabel(startMs, webinar.timezone),
    turma: turma(startMs, webinar),
    fuso: webinar.timezone,
    inscrito_em: new Date(registration.createdAt).toISOString(),
    link_sessao: registration.sessionUrl,
  };
}

/**
 * A falha de uma ferramenta de marketing não pode cancelar o acesso do lead ao
 * webinar. Por isso o erro é registrado sem expor dados pessoais e a inscrição
 * continua válida no Supabase.
 */
export async function notifyLeadWebhook(
  webinar: WebinarWebhookConfig,
  registration: LeadRegistration,
  source: LeadSource
) {
  const url = configuredWebhookUrl(webinar.integrations);
  if (!url) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(buildLeadWebhookPayload(webinar, registration, source)),
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Lead webhook returned a non-success status", {
        webinarType: webinar.type,
        status: response.status,
      });
    }
  } catch (error) {
    console.error("Lead webhook delivery failed", {
      webinarType: webinar.type,
      reason: error instanceof Error ? error.name : "unknown",
    });
  } finally {
    clearTimeout(timeout);
  }
}
