import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Webhook da Hotmart (Postback 2.0). Configurar na Hotmart:
 *   Ferramentas → Webhook → URL: https://SEU-DOMINIO/api/hotmart
 *   Eventos: Compra aprovada (e opcionalmente reembolso/chargeback).
 *
 * Segurança: a Hotmart manda o header `x-hotmart-hottok` (token fixo mostrado
 * no painel dela). Com a env HOTMART_HOTTOK setada na Vercel, só aceitamos
 * requests com o token certo; sem a env, aceitamos e guardamos mesmo assim
 * (URL não divulgada) — mas o ideal é setar a env.
 *
 * Atribuição da compra à live:
 *   1. `sck` do link do checkout: "aw|<webinar_id>|<session_iso>" (exata —
 *      o player anexa isso ao CTA da oferta);
 *   2. fallback: e-mail do comprador × registrations (pega a inscrição mais
 *      recente já iniciada na hora da compra);
 *   3. senão fica sem atribuição (aparece fora das lives, mas é guardada).
 */

type Json = Record<string, unknown>;

function get(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Json)[k];
  }
  return cur;
}
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** sck "aw|<webinar_id>|<session_iso>" → atribuição exata. */
function parseSck(raw: unknown): { webinarId: string; sessionIso: string | null } | null {
  const s = str(raw);
  if (!s || !s.startsWith("aw|")) return null;
  const [, webinarId, sessionIso] = s.split("|");
  if (!webinarId) return null;
  const iso = sessionIso ? new Date(sessionIso) : null;
  return {
    webinarId,
    sessionIso: iso && !Number.isNaN(iso.getTime()) ? iso.toISOString() : null,
  };
}

export async function POST(request: Request) {
  // valida o token da Hotmart quando configurado
  const expected = process.env.HOTMART_HOTTOK;
  if (expected) {
    const got = request.headers.get("x-hotmart-hottok");
    if (got !== expected) {
      return NextResponse.json({ error: "hottok inválido" }, { status: 401 });
    }
  }

  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const event = str(body.event) ?? "UNKNOWN";
  const data = (body.data ?? {}) as Json;

  const transaction =
    str(get(data, ["purchase", "transaction"])) ?? str(get(data, ["transaction"]));
  const buyerEmail =
    str(get(data, ["buyer", "email"]))?.toLowerCase() ?? null;
  const buyerName = str(get(data, ["buyer", "name"]));
  const productName = str(get(data, ["product", "name"]));
  const priceValue =
    num(get(data, ["purchase", "price", "value"])) ?? num(get(data, ["price", "value"]));
  const priceCurrency =
    str(get(data, ["purchase", "price", "currency_value"])) ??
    str(get(data, ["price", "currency_value"]));
  const occurredMs =
    num(get(data, ["purchase", "approved_date"])) ??
    num(get(data, ["purchase", "order_date"])) ??
    num(body.creation_date);
  const occurredAt = occurredMs ? new Date(occurredMs) : new Date();

  // ---- atribuição ----
  const sck =
    parseSck(get(data, ["purchase", "origin", "sck"])) ??
    parseSck(get(data, ["purchase", "sckPaymentLink"])) ??
    parseSck(get(data, ["origin", "sck"]));

  const supabase = supabaseAdmin();
  let webinarId: string | null = sck?.webinarId ?? null;
  let sessionStart: string | null = sck?.sessionIso ?? null;

  if (!webinarId && buyerEmail) {
    // fallback: inscrição mais recente cuja live já tinha começado na compra
    const { data: regs } = await supabase
      .from("registrations")
      .select("webinar_id, scheduled_start_at")
      .ilike("email", buyerEmail)
      .order("scheduled_start_at", { ascending: false })
      .limit(10);
    type Reg = { webinar_id: string; scheduled_start_at: string };
    const list = (regs ?? []) as Reg[];
    const past = list.find(
      (r) => new Date(r.scheduled_start_at).getTime() <= occurredAt.getTime()
    );
    const chosen = past ?? list[0] ?? null;
    if (chosen) {
      webinarId = chosen.webinar_id;
      sessionStart = new Date(chosen.scheduled_start_at).toISOString();
    }
  }

  const { error } = await supabase.from("purchases").insert({
    webinar_id: webinarId,
    session_start: sessionStart,
    event,
    transaction_id: transaction,
    buyer_name: buyerName,
    buyer_email: buyerEmail,
    product_name: productName,
    price_value: priceValue,
    price_currency: priceCurrency,
    raw: body,
    occurred_at: occurredAt.toISOString(),
  });

  // 23505 = já recebido (reenvio da Hotmart) → responde ok pra ela parar.
  if (error && !error.message.includes("duplicate key")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
