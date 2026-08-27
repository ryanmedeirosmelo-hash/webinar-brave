"use server";

import { createClient } from "@supabase/supabase-js";
import { phoneKey } from "@/lib/phone";
import { ADMIN_TIMEZONE } from "@/lib/brand";

/**
 * Painel "Disparos" da Área 1: quem recebeu cada mensagem de WhatsApp que
 * convida para o webinário — INTEGRAÇÃO OPCIONAL.
 *
 * Os envios acontecem num CRM externo (fluxos do tipo "É hoje", "Falta 1 hora",
 * "Ao vivo"…), então lemos DIRETO o banco do CRM (somente leitura) — tabelas
 * flow_step_executions, flows, leads e interacoes, sempre filtradas pelo tenant
 * configurado. Isso só liga quando as envs CRM_SUPABASE_URL,
 * CRM_SUPABASE_SERVICE_ROLE_KEY e CRM_WEBINAR_TENANT_ID existem; sem elas o
 * painel apenas informa que a integração não está configurada, e nada quebra.
 *
 * O schema esperado é o de um CRM com fluxos de automação (ver README). Se o
 * seu CRM for outro, este arquivo é o único ponto a adaptar.
 *
 * Um "disparo" = um step de envio × um dia (fuso do webinar): o webhook do CRM
 * chega 1 lead por vez, então o agrupamento por dia é o que reconstitui a
 * "rajada" da live.
 */

type Result<T> = { success: true; data: T } | { success: false; error: string };

const SEND_STEP_TYPES = ["send_message", "send_template"];

function crm() {
  // Aspas sobram quando a env é copiada de um .env — `createClient` rejeita a
  // URL e derrubava quem chama.
  const clean = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, "") || undefined;
  const url = clean(process.env.CRM_SUPABASE_URL);
  const key = clean(process.env.CRM_SUPABASE_SERVICE_ROLE_KEY);
  const tenant = clean(process.env.CRM_WEBINAR_TENANT_ID);
  if (!url || !key || !tenant) return null;
  try {
    return {
      client: createClient(url, key, { auth: { persistSession: false } }),
      tenant,
    };
  } catch {
    return null; // env torta não pode derrubar quem só queria os disparos
  }
}

/** 'YYYY-MM-DD' no fuso de São Paulo — chave estável de agrupamento por dia. */
function spDayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ADMIN_TIMEZONE });
}

/**
 * Convidados por dia: telefones (chave curta) que RECEBERAM disparo do webinário
 * naquele dia, no fuso de SP. É a base da taxa de comparecimento real — "de quem
 * eu chamei no WhatsApp, quantos vieram" — em vez de comparar com quem se
 * cadastrou na porta. Fora do dia da live não interessa: os fluxos "É hoje",
 * "Falta 1 hora" e "Ao vivo" disparam no próprio dia da aula.
 *
 * Sem as envs do CRM devolve mapa vazio (a métrica some do painel, nada quebra).
 */
export async function getInvitedPhonesByDay(): Promise<Record<string, string[]>> {
  const db = crm();
  if (!db) return {};

  const execRes = await fetchSendExecutions(db);
  if ("error" in execRes) return {};
  const rows = execRes.rows.filter((r) => r.status === "success" || r.status === "waiting");

  const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))];
  const phoneById = new Map<string, string | null>();
  for (let i = 0; i < leadIds.length; i += 500) {
    const { data, error } = await db.client
      .from("leads")
      .select("id, phone")
      .in("id", leadIds.slice(i, i + 500));
    if (error) return {};
    for (const l of (data ?? []) as { id: string; phone: string | null }[]) {
      phoneById.set(l.id, l.phone);
    }
  }

  const byDay = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = phoneKey(phoneById.get(r.lead_id));
    if (!key) continue;
    const day = spDayOf(r.executed_at);
    const set = byDay.get(day) ?? new Set<string>();
    set.add(key);
    byDay.set(day, set);
  }

  return Object.fromEntries([...byDay.entries()].map(([d, s]) => [d, [...s]]));
}

type SendExecutionRow = {
  id: string;
  enrollment_id: string;
  lead_id: string;
  flow_id: string;
  step_id: string;
  step_type: string;
  status: "success" | "failed" | "skipped" | "waiting";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  executed_at: string;
};

/**
 * Todas as execuções de steps de envio do tenant (paginado — o PostgREST corta
 * em 1000), com retries reduzidos à execução mais recente por
 * (enrollment, step, dia).
 */
async function fetchSendExecutions(
  db: NonNullable<ReturnType<typeof crm>>,
  filter?: { flowId: string; fromIso: string; toIso: string }
): Promise<{ rows: SendExecutionRow[] } | { error: string }> {
  const PAGE = 1000;
  const all: SendExecutionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.client
      .from("flow_step_executions")
      .select(
        "id, enrollment_id, lead_id, flow_id, step_id, step_type, status, error_message, metadata, executed_at"
      )
      .eq("tenant_id", db.tenant)
      .in("step_type", SEND_STEP_TYPES)
      .order("executed_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (filter) {
      q = q
        .eq("flow_id", filter.flowId)
        .gte("executed_at", filter.fromIso)
        .lt("executed_at", filter.toIso);
    }
    const { data, error } = await q;
    if (error) return { error: error.message };
    all.push(...((data ?? []) as SendExecutionRow[]));
    if (!data || data.length < PAGE) break;
  }
  const latest = new Map<string, SendExecutionRow>();
  for (const r of all) latest.set(`${r.enrollment_id}|${r.step_id}|${spDayOf(r.executed_at)}`, r);
  return { rows: [...latest.values()] };
}

/** Extrai um rótulo legível de um step de envio (config do fluxo). */
function stepLabel(cfg: Record<string, unknown>): string | null {
  if (typeof cfg.template_name === "string" && cfg.template_name) return cfg.template_name;
  if (typeof cfg.message === "string" && cfg.message) {
    const m = cfg.message;
    return `"${m.slice(0, 50)}${m.length > 50 ? "…" : ""}"`;
  }
  return null;
}

/**
 * Mapa step_id → rótulo, varrendo os steps do fluxo INCLUSIVE dentro de
 * condition (SE/SENÃO) — os envios de ramo têm step_id sintético que não está
 * em flows.steps, então pra eles o rótulo vem do metadata.label da execução.
 */
function buildLabels(steps: unknown): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!Array.isArray(steps)) return labels;
  for (const s of steps as { id?: string; type?: string; config?: Record<string, unknown> }[]) {
    if (!s?.id || !s.config) continue;
    const l = stepLabel(s.config);
    if (l) labels[s.id] = l;
  }
  return labels;
}

export type Disparo = {
  key: string; // `${flowId}|${stepId}|${day}`
  flowId: string;
  flowName: string;
  stepId: string;
  label: string; // template/mensagem enviada
  day: string; // 'YYYY-MM-DD' (SP)
  firstAt: string;
  lastAt: string;
  total: number;
  success: number;
  failed: number;
  skipped: number;
};

export async function getDisparos(): Promise<Result<Disparo[]>> {
  const db = crm();
  if (!db) return { success: false, error: "Integração com o CRM não configurada (envs CRM_*)." };

  const [{ data: flows, error: flowsError }, execRes] = await Promise.all([
    db.client.from("flows").select("id, name, steps").eq("tenant_id", db.tenant),
    fetchSendExecutions(db),
  ]);
  if (flowsError) return { success: false, error: flowsError.message };
  if ("error" in execRes) return { success: false, error: execRes.error };

  type FlowRow = { id: string; name: string; steps: unknown };
  const flowById = new Map<string, { name: string; labels: Record<string, string> }>();
  for (const f of (flows ?? []) as FlowRow[]) {
    flowById.set(f.id, { name: f.name, labels: buildLabels(f.steps) });
  }

  const groups = new Map<string, Disparo>();
  for (const r of execRes.rows) {
    const day = spDayOf(r.executed_at);
    const key = `${r.flow_id}|${r.step_id}|${day}`;
    const flow = flowById.get(r.flow_id);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        flowId: r.flow_id,
        flowName: flow?.name ?? "(fluxo removido)",
        stepId: r.step_id,
        label:
          flow?.labels[r.step_id] ??
          (r.metadata && typeof r.metadata.label === "string" ? r.metadata.label : null) ??
          (r.step_type === "send_template" ? "Template" : "Mensagem"),
        day,
        firstAt: r.executed_at,
        lastAt: r.executed_at,
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
      };
      groups.set(key, g);
    }
    g.total++;
    // 'waiting' = template enviado, aguardando botão — pro destinatário, recebeu.
    if (r.status === "success" || r.status === "waiting") g.success++;
    else if (r.status === "failed") g.failed++;
    else g.skipped++;
    if (r.executed_at < g.firstAt) g.firstAt = r.executed_at;
    if (r.executed_at > g.lastAt) g.lastAt = r.executed_at;
  }

  const list = [...groups.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  return { success: true, data: list };
}

export type DisparoRecipient = {
  executionId: string;
  leadName: string | null;
  leadPhone: string | null;
  status: "success" | "failed" | "skipped";
  errorMessage: string | null;
  executedAt: string;
  // Status real de entrega (webhooks do Meta em interacoes); null = sem casamento.
  deliveryStatus: "sent" | "delivered" | "read" | "failed" | null;
  deliveryError: string | null;
};

export async function getDisparoRecipients(
  flowId: string,
  stepId: string,
  day: string
): Promise<Result<DisparoRecipient[]>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { success: false, error: "Dia inválido" };
  const db = crm();
  if (!db) return { success: false, error: "Integração com o CRM não configurada (envs CRM_*)." };

  // Janela do dia em SP (UTC-3 fixo desde 2019 — sem horário de verão).
  const fromMs = new Date(`${day}T00:00:00-03:00`).getTime();
  const execRes = await fetchSendExecutions(db, {
    flowId,
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(fromMs + 24 * 60 * 60 * 1000).toISOString(),
  });
  if ("error" in execRes) return { success: false, error: execRes.error };
  const rows = execRes.rows.filter((r) => r.step_id === stepId);

  // Leads em lotes (sem join — padrão do CRM pra volume).
  const leadIds = [...new Set(rows.map((r) => r.lead_id))];
  const leadById = new Map<string, { name: string | null; phone: string | null }>();
  for (let i = 0; i < leadIds.length; i += 500) {
    const { data, error } = await db.client
      .from("leads")
      .select("id, name, phone")
      .in("id", leadIds.slice(i, i + 500));
    if (error) return { success: false, error: error.message };
    for (const l of (data ?? []) as { id: string; name: string | null; phone: string | null }[]) {
      leadById.set(l.id, { name: l.name, phone: l.phone });
    }
  }

  // Entrega real: interação outbound mais próxima no tempo (±5 min) — o log do
  // step não guarda interacao_id, então o casamento é temporal.
  type InteracaoRow = {
    lead_id: string;
    delivery_status: string | null;
    send_error: string | null;
    created_at: string;
  };
  const interacoesByLead = new Map<string, InteracaoRow[]>();
  if (rows.length > 0) {
    const PAD_MS = 5 * 60 * 1000;
    const execMin = Math.min(...rows.map((r) => new Date(r.executed_at).getTime()));
    const execMax = Math.max(...rows.map((r) => new Date(r.executed_at).getTime()));
    for (let i = 0; i < leadIds.length; i += 500) {
      const { data } = await db.client
        .from("interacoes")
        .select("lead_id, delivery_status, send_error, created_at")
        .in("lead_id", leadIds.slice(i, i + 500))
        .eq("direction", "outbound")
        .eq("tipo", "whatsapp")
        .gte("created_at", new Date(execMin - PAD_MS).toISOString())
        .lte("created_at", new Date(execMax + PAD_MS).toISOString());
      for (const it of (data ?? []) as InteracaoRow[]) {
        const list = interacoesByLead.get(it.lead_id) ?? [];
        list.push(it);
        interacoesByLead.set(it.lead_id, list);
      }
    }
  }

  const MATCH_TOLERANCE_MS = 5 * 60 * 1000;
  const recipients: DisparoRecipient[] = rows.map((r) => {
    const lead = leadById.get(r.lead_id);
    let deliveryStatus: DisparoRecipient["deliveryStatus"] = null;
    let deliveryError: string | null = null;
    if (r.status === "success" || r.status === "waiting") {
      const execMs = new Date(r.executed_at).getTime();
      let best: InteracaoRow | null = null;
      let bestDist = MATCH_TOLERANCE_MS;
      for (const it of interacoesByLead.get(r.lead_id) ?? []) {
        const dist = Math.abs(new Date(it.created_at).getTime() - execMs);
        if (dist <= bestDist) {
          bestDist = dist;
          best = it;
        }
      }
      if (best) {
        deliveryStatus = (best.delivery_status ?? "sent") as DisparoRecipient["deliveryStatus"];
        deliveryError = best.send_error;
      }
    }
    return {
      executionId: r.id,
      leadName: lead?.name ?? null,
      leadPhone: lead?.phone ?? null,
      status: r.status === "waiting" ? "success" : r.status,
      errorMessage: r.error_message,
      executedAt: r.executed_at,
      deliveryStatus,
      deliveryError,
    };
  });

  recipients.sort((a, b) => (a.leadName ?? "").localeCompare(b.leadName ?? "", "pt-BR"));
  return { success: true, data: recipients };
}
