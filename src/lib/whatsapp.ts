type IntegrationConfig = { enabled?: unknown; value?: unknown };

/**
 * Normaliza números de WhatsApp para o formato aceito pelo wa.me.
 * Números brasileiros locais (DDD + número) recebem o DDI 55 automaticamente;
 * números internacionais devem ser informados já com DDI.
 */
export function normalizeWhatsAppNumber(value: unknown): string | null {
  const digits = typeof value === "string" ? value.replace(/\D/g, "").replace(/^00/, "") : "";
  if (!digits) return null;

  const international = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return international.length >= 10 && international.length <= 15 ? international : null;
}

/** Número de suporte do webinar, habilitado na etapa Integrações do painel. */
export function supportWhatsAppNumber(integrations: Record<string, unknown> | null | undefined) {
  const raw = integrations?.whatsapp;
  if (!raw || typeof raw !== "object") return null;

  const config = raw as IntegrationConfig;
  return config.enabled === true ? normalizeWhatsAppNumber(config.value) : null;
}

export function supportWhatsAppHref(number: string | null | undefined) {
  const normalized = normalizeWhatsAppNumber(number);
  if (!normalized) return null;

  const message = "Olá! Acabei de assistir a aula ao vivo e preciso de ajuda.";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
