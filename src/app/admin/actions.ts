"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { nextSessionStart } from "@/lib/time";
import { phoneKey } from "@/lib/phone";
import { getInvitedPhonesByDay } from "@/app/admin/disparos";
import type { Webinar } from "@/types/db";
import { ADMIN_TIMEZONE } from "@/lib/brand";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function num(v: FormDataEntryValue | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(v: FormDataEntryValue | null) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Converte "hh:mm:ss", "mm:ss" ou só segundos em total de segundos. */
function parseDuration(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const total =
    parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts.length === 2
        ? parts[0] * 60 + parts[1]
        : parts[0];
  return total > 0 ? Math.round(total) : null;
}

// ---------------- Webinar ----------------

export async function createWebinar(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim() || "Novo Webinar";
  const supabase = supabaseAdmin();
  const base = slugify(title) || "webinar";
  // garante slug único
  let slug = base;
  for (let i = 2; ; i++) {
    const { data } = await supabase.from("webinars").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await supabase
    .from("webinars")
    .insert({ title, slug, video_url: "/videos/aula.mp4", duration_seconds: 600 })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Falha ao criar webinar");
  redirect(`/admin/webinars/${data.id}`);
}

// Atualização PARCIAL: cada etapa do wizard manda só os seus campos.
// Só gravamos colunas cujo campo veio no formData (evita apagar o resto).
export async function updateWebinar(formData: FormData) {
  const id = String(formData.get("id"));
  const f = formData;
  const u: Record<string, unknown> = {};

  const txt = (k: string) => String(f.get(k) ?? "").trim();
  const has = (k: string) => f.has(k);

  if (has("internal_name")) u.internal_name = txt("internal_name") || null;
  if (has("title")) u.title = txt("title");
  if (has("slug")) u.slug = slugify(txt("slug"));
  if (has("language")) u.language = txt("language") || "pt-BR";
  if (has("presenter_name")) u.presenter_name = txt("presenter_name") || null;
  if (has("presenter_avatar_url")) u.presenter_avatar_url = txt("presenter_avatar_url") || null;
  if (has("description")) u.description = txt("description") || null;
  if (has("video_url")) u.video_url = txt("video_url");
  if (has("duration_seconds")) u.duration_seconds = num(f.get("duration_seconds"), 600);
  if (has("timezone")) u.timezone = txt("timezone") || ADMIN_TIMEZONE;
  if (has("status")) u.status = txt("status") || "active";
  if (has("type")) u.type = txt("type") || "unico";
  if (has("jit_interval_minutes")) u.jit_interval_minutes = num(f.get("jit_interval_minutes"), 15);
  if (has("available_times")) {
    u.available_times = txt("available_times")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  if (has("audience_mode")) u.audience_mode = txt("audience_mode") || "dynamic";
  if (has("audience_base")) u.audience_base = num(f.get("audience_base"), 150);

  // Etapa 2 — datas / recorrência / sala de espera
  if (has("start_at")) u.start_at = txt("start_at") || null;
  if (has("end_at")) u.end_at = txt("end_at") || null;
  if (has("recurrence_present")) {
    u.recurrence_enabled = f.get("recurrence_enabled") === "on";
    // Dias da semana ISO (1=seg … 7=dom) marcados nos checkboxes.
    const dayNames = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const days: number[] = [];
    for (let d = 1; d <= 7; d++) if (f.get(`recurrence_day_${d}`) === "on") days.push(d);
    u.recurrence_days = days;
    // recurrence_dow segue só como rótulo de divulgação, gerado a partir dos dias.
    const times = txt("available_times")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    u.recurrence_dow = days.length
      ? `${days.map((d) => dayNames[d]).join(", ")}${times.length ? ` às ${times.join(" / ")}` : ""}`
      : null;
  }
  if (has("recurrence_freq")) u.recurrence_freq = txt("recurrence_freq") || "weekly";
  if (has("waiting_present")) u.waiting_room_enabled = f.get("waiting_room_enabled") === "on";
  if (has("waiting_room_page")) u.waiting_room_page = txt("waiting_room_page") || "default";

  // Etapa 3 — login / captura
  if (has("logo_url")) u.logo_url = txt("logo_url") || null;
  if (has("login_present")) u.progress_bar_enabled = f.get("progress_bar_enabled") === "on";
  if (has("progress_start")) u.progress_start = num(f.get("progress_start"), 80);
  if (has("progress_bar_color")) u.progress_bar_color = txt("progress_bar_color") || "#e11d48";
  if (has("progress_text_color")) u.progress_text_color = txt("progress_text_color") || "#ffffff";
  if (has("capture_title")) u.capture_title = txt("capture_title") || null;
  if (has("capture_button_label")) u.capture_button_label = txt("capture_button_label") || "Assistir";
  if (has("capture_button_color")) u.capture_button_color = txt("capture_button_color") || "#16a34a";
  if (has("capture_button_text_color"))
    u.capture_button_text_color = txt("capture_button_text_color") || "#ffffff";
  if (has("login_present")) {
    const keys: Array<"name" | "email" | "whatsapp"> = ["name", "email", "whatsapp"];
    u.form_fields = keys.map((k) => ({
      key: k,
      enabled: f.get(`field_${k}_enabled`) === "on",
      required: f.get(`field_${k}_required`) === "on",
      label: txt(`field_${k}_label`),
    }));
  }

  // Etapa 4 — vídeo
  if (has("video_provider")) u.video_provider = txt("video_provider") || "upload";
  if (has("video_external_url")) u.video_external_url = txt("video_external_url") || null;
  if (has("video_duration")) {
    // Só sobrescreve a duração se o usuário informou um valor válido
    // (upload próprio auto-detecta e deixa o campo vazio).
    const parsed = parseDuration(f.get("video_duration"));
    if (parsed) u.duration_seconds = parsed;
  }
  if (has("video_present")) {
    u.video_autoplay = f.get("video_autoplay") === "on";
    u.video_fullscreen = f.get("video_fullscreen") === "on";
  }

  // Etapa 7 — título da notificação de venda
  if (has("sales_notification_title")) u.sales_notification_title = txt("sales_notification_title") || null;

  // Etapa 8 — audiência min/max + botão ao vivo
  if (has("audience_min")) u.audience_min = num(f.get("audience_min"), 45);
  if (has("audience_max")) u.audience_max = num(f.get("audience_max"), 120);
  if (has("audience_present")) {
    // 3 modos via radio: none | fixed | dynamic
    const mode = txt("audience_radio") || "dynamic";
    u.audience_mode = mode;
    u.audience_enabled = mode !== "none";
    u.show_live_button = f.get("show_live_button") === "on";
  }

  if (Object.keys(u).length > 0) {
    const { error } = await supabaseAdmin().from("webinars").update(u).eq("id", id);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/admin/webinars/${id}`, "layout");
  revalidatePath("/admin");

  // "Continuar" salva e avança pra próxima etapa do wizard.
  const to = String(f.get("__redirect") ?? "");
  if (to.startsWith("/admin/webinars/")) redirect(to);
}

export async function deleteWebinar(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = supabaseAdmin();
  await supabase.from("webinars").delete().eq("id", id);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function duplicateWebinar(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = supabaseAdmin();

  const { data: w } = await supabase.from("webinars").select("*").eq("id", id).single();
  if (!w) throw new Error("Webinar não encontrado");

  const base = `${w.slug}-copia`;
  let slug = base;
  for (let i = 2; ; i++) {
    const { data } = await supabase.from("webinars").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }

  const { id: _id, created_at: _c, slug: _s, title: _t, ...rest } = w;
  const { data: copy } = await supabase
    .from("webinars")
    .insert({ ...rest, slug, title: `${w.title} (cópia)`, status: "draft" })
    .select("id")
    .single();

  if (copy) {
    // copia filhos
    for (const table of ["chat_messages", "offers", "sales_notifications"]) {
      const { data: rows } = await supabase.from(table).select("*").eq("webinar_id", id);
      if (rows?.length) {
        const cloned = rows.map(({ id: _ri, ...r }) => ({ ...r, webinar_id: copy.id }));
        await supabase.from(table).insert(cloned);
      }
    }
  }
  revalidatePath("/admin");
  redirect("/admin");
}

// ---------------- Chat ----------------

export async function addChatMessage(formData: FormData) {
  const webinarId = String(formData.get("webinar_id"));
  const supabase = supabaseAdmin();
  await supabase.from("chat_messages").insert({
    webinar_id: webinarId,
    at_seconds: num(formData.get("at_seconds"), 0),
    author_name: String(formData.get("author_name") ?? "").trim() || "Participante",
    message: String(formData.get("message") ?? "").trim(),
  });
  revalidatePath(`/admin/webinars/${webinarId}`);
}

export async function deleteChatMessage(formData: FormData) {
  const id = String(formData.get("id"));
  const webinarId = String(formData.get("webinar_id"));
  await supabaseAdmin().from("chat_messages").delete().eq("id", id);
  revalidatePath(`/admin/webinars/${webinarId}`);
}

export async function clearChat(formData: FormData) {
  const webinarId = String(formData.get("webinar_id"));
  await supabaseAdmin().from("chat_messages").delete().eq("webinar_id", webinarId);
  revalidatePath(`/admin/webinars/${webinarId}`);
}

/** "HH:MM:SS" | "MM:SS" | "SS" | número -> segundos. */
function parseTimeToSeconds(raw: string): number {
  const t = raw.trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const parts = t.split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Importa chat via planilha colada (CSV): tempo, nome, mensagem por linha. */
export async function importChatCsv(formData: FormData) {
  const webinarId = String(formData.get("webinar_id"));
  const csv = String(formData.get("csv") ?? "");
  const rows = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^tempo|^hor[aá]rio/i.test(l))
    .map((line) => {
      const cols = line.split(/[;,\t]/).map((c) => c.trim());
      return {
        webinar_id: webinarId,
        at_seconds: parseTimeToSeconds(cols[0] ?? "0"),
        author_name: cols[1] || "Participante",
        message: cols.slice(2).join(", ") || "",
      };
    })
    .filter((r) => r.message);
  if (rows.length) await supabaseAdmin().from("chat_messages").insert(rows);
  revalidatePath(`/admin/webinars/${webinarId}/chat`);
}

/** Importa vendas via planilha colada (CSV): tempo, nome, cidade por linha. */
export async function importSalesCsv(formData: FormData) {
  const webinarId = String(formData.get("webinar_id"));
  const csv = String(formData.get("csv") ?? "");
  const rows = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^tempo|^hor[aá]rio/i.test(l))
    .map((line) => {
      const cols = line.split(/[;,\t]/).map((c) => c.trim());
      return {
        webinar_id: webinarId,
        at_seconds: parseTimeToSeconds(cols[0] ?? "0"),
        buyer_name: cols[1] || "Cliente",
        buyer_city: cols[2] || null,
        product_label: cols[3] || "acabou de garantir a vaga",
      };
    })
    .filter((r) => r.buyer_name);
  if (rows.length) await supabaseAdmin().from("sales_notifications").insert(rows);
  revalidatePath(`/admin/webinars/${webinarId}/vendas`);
}

// Pools p/ o gerador automático de chat (efeito "sala ao vivo").
const CHAT_NAMES = [
  "Ana Souza", "Carlos M.", "Juliana R.", "Marcos Lima", "Bia Fernandes",
  "Rafael T.", "Pedro L.", "Larissa", "Diego Alves", "Camila S.", "Thiago",
  "Patrícia", "Gustavo R.", "Fernanda", "Lucas P.", "Mariana A.", "Bruno C.",
  "Renata", "Vinícius", "Aline C.", "Rodrigo P.", "Tatiane M.", "Eduardo",
  "Sabrina", "Felipe N.", "Vanessa", "André L.", "Priscila", "Roberto",
];
const CHAT_OPENERS = [
  "Boa noite, chegando agora!", "Cheguei! 🙌", "Presente!", "De onde vocês estão assistindo?",
  "SP aqui!", "Curitiba presente 🙌", "Salvador na área!", "Boa noite a todos 👋",
];
const CHAT_MIDDLE = [
  "Som e imagem perfeitos 👏", "Essa parte é ouro!", "Anotando tudo aqui ✍️",
  "Faz muito sentido", "Que aula 🔥", "Tá show demais", "Nunca tinha visto assim",
  "Isso mudou minha visão", "Caramba, que insight", "Repetindo: isso é ouro",
  "Já tô aplicando", "Melhor conteúdo que já vi", "Tô amando 😍", "Manda mais!",
  "Pode repetir essa parte?", "Salvando esse print", "Top demais 👏👏",
];
const CHAT_LATE = [
  "Já quero a oferta 🔥", "Cadê o link?", "Quero garantir a minha!", "Comprando agora!",
  "Garanti a vaga ✅", "Vale cada centavo", "Melhor decisão", "Bora que bora 🚀",
  "Tô dentro!", "Acabei de comprar 🎉", "Obrigada pela aula! 🙏",
];

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function generateChat(formData: FormData) {
  const webinarId = String(formData.get("webinar_id"));
  const count = Math.min(120, Math.max(1, num(formData.get("count"), 25)));
  const supabase = supabaseAdmin();

  const { data: w } = await supabase
    .from("webinars")
    .select("duration_seconds")
    .eq("id", webinarId)
    .single();
  const duration = w?.duration_seconds ?? 600;

  const rows = Array.from({ length: count }, (_, i) => {
    // distribui ao longo da aula com jitter; concentra reações no fim
    const frac = (i + Math.random()) / count;
    const at = Math.max(1, Math.floor(frac * duration * 0.96));
    const pool = frac < 0.15 ? CHAT_OPENERS : frac > 0.7 ? CHAT_LATE : CHAT_MIDDLE;
    return {
      webinar_id: webinarId,
      at_seconds: at,
      author_name: pick(CHAT_NAMES),
      message: pick(pool),
    };
  }).sort((a, b) => a.at_seconds - b.at_seconds);

  await supabase.from("chat_messages").insert(rows);
  revalidatePath(`/admin/webinars/${webinarId}`);
}

// ---------------- Oferta ----------------

export async function addOffer(formData: FormData) {
  const webinarId = String(formData.get("webinar_id"));
  await supabaseAdmin().from("offers").insert({
    webinar_id: webinarId,
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim() || null,
    cta_label: String(formData.get("cta_label") ?? "").trim() || "Comprar agora",
    cta_url: String(formData.get("cta_url") ?? "").trim(),
    show_at_seconds: num(formData.get("show_at_seconds"), 0),
    hide_at_seconds: numOrNull(formData.get("hide_at_seconds")),
    original_price: numOrNull(formData.get("original_price")),
    offer_price: numOrNull(formData.get("offer_price")),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
  });
  revalidatePath(`/admin/webinars/${webinarId}`);
}

export async function deleteOffer(formData: FormData) {
  const id = String(formData.get("id"));
  const webinarId = String(formData.get("webinar_id"));
  await supabaseAdmin().from("offers").delete().eq("id", id);
  revalidatePath(`/admin/webinars/${webinarId}`);
}

function hms(f: FormData, prefix: string) {
  const h = num(f.get(`${prefix}_h`), 0);
  const m = num(f.get(`${prefix}_m`), 0);
  const s = num(f.get(`${prefix}_s`), 0);
  return h * 3600 + m * 60 + s;
}

// Etapa 5 — salva a oferta ÚNICA do webinar (cria se não existir).
export async function saveOffer(formData: FormData) {
  const f = formData;
  const webinarId = String(f.get("webinar_id"));
  const txt = (k: string) => String(f.get(k) ?? "").trim();
  const supabase = supabaseAdmin();

  const data = {
    webinar_id: webinarId,
    name: txt("name") || null,
    title: txt("title"),
    cta_label: txt("cta_label") || "Comprar agora",
    cta_url: txt("cta_url"),
    button_color: txt("button_color") || "#16a34a",
    price_original_text: txt("price_original_text") || null,
    price_offer_text: txt("price_offer_text") || null,
    image_desktop_url: txt("image_desktop_url") || null,
    image_mobile_url: txt("image_mobile_url") || null,
    pitch_start_seconds: hms(f, "pitch"),
    show_at_seconds: hms(f, "show"),
    hide_at_seconds: hms(f, "hide") || null,
    utm_passthrough: f.get("utm_passthrough") === "on",
    disabled: f.get("disabled") === "on",
    open_same_window: f.get("open_same_window") === "on",
    raffle_enabled: f.get("raffle_enabled") === "on",
  };

  const { data: existing } = await supabase
    .from("offers")
    .select("id")
    .eq("webinar_id", webinarId)
    .order("show_at_seconds")
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase.from("offers").update(data).eq("id", existing.id);
  } else {
    await supabase.from("offers").insert(data);
  }

  revalidatePath(`/admin/webinars/${webinarId}/oferta`);
  const to = txt("__redirect");
  if (to.startsWith("/admin/webinars/")) redirect(to);
}

// Etapa 9 — salva o mapa de integrações no webinar.
const INTEGRATION_KEYS = [
  "active_campaign", "whatsapp", "keap", "sellflux", "kommo", "manychat",
  "webhook", "gtm", "custom_script", "facebook_pixel", "tiktok_pixel",
];

export async function saveIntegrations(formData: FormData) {
  const f = formData;
  const webinarId = String(f.get("webinar_id"));
  const integrations: Record<string, { enabled: boolean; value: string }> = {};
  for (const k of INTEGRATION_KEYS) {
    integrations[k] = {
      enabled: f.get(`int_${k}_enabled`) === "on",
      value: String(f.get(`int_${k}_value`) ?? "").trim(),
    };
  }
  await supabaseAdmin().from("webinars").update({ integrations }).eq("id", webinarId);
  revalidatePath(`/admin/webinars/${webinarId}/integracoes`);
  const to = String(f.get("__redirect") ?? "");
  if (to.startsWith("/admin")) redirect(to);
}

// ---------------- Vendas (notificações) ----------------

export async function addSalesNotification(formData: FormData) {
  const webinarId = String(formData.get("webinar_id"));
  await supabaseAdmin().from("sales_notifications").insert({
    webinar_id: webinarId,
    at_seconds: num(formData.get("at_seconds"), 0),
    buyer_name: String(formData.get("buyer_name") ?? "").trim() || "Cliente",
    buyer_city: String(formData.get("buyer_city") ?? "").trim() || null,
    product_label:
      String(formData.get("product_label") ?? "").trim() || "acabou de garantir a vaga",
  });
  revalidatePath(`/admin/webinars/${webinarId}`);
}

export async function deleteSalesNotification(formData: FormData) {
  const id = String(formData.get("id"));
  const webinarId = String(formData.get("webinar_id"));
  await supabaseAdmin().from("sales_notifications").delete().eq("id", id);
  revalidatePath(`/admin/webinars/${webinarId}`);
}

// ---------- Métricas reais (área admin) ----------

/**
 * PostgREST devolve no máximo 1000 linhas por request (limite do Supabase).
 * Sem paginar, uma métrica que lê "todas as sessões" passa a MENTIR em silêncio
 * assim que a tabela cresce. Este helper varre em páginas até acabar.
 */
const PAGE_SIZE = 1000;
const MAX_ROWS = 200_000; // trava de segurança (não trava a UI num loop eterno)

async function fetchAll<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    // Erro NÃO pode virar lista vazia: a página mostraria "0 lives" com cara de
    // verdade (foi o que aconteceu quando a coluna `minutes` faltava no banco).
    if (error) throw new Error(`Falha ao ler métricas: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

/**
 * A migration 0014 (coluna `minutes`) pode não estar aplicada no banco que este
 * deploy está lendo. Sem checar, o select quebra e TODAS as métricas somem.
 * Probe uma vez; só o "tem a coluna" fica em cache (assim, aplicar a migration
 * passa a valer sem precisar redeployar).
 */
let minutesColumnOk = false;
async function hasMinutesColumn(
  supabase: ReturnType<typeof supabaseAdmin>
): Promise<boolean> {
  if (minutesColumnOk) return true;
  const { error } = await supabase.from("watch_sessions").select("minutes").limit(1);
  minutesColumnOk = !error;
  return minutesColumnOk;
}

/** Resumo de uma live específica (um dia/horário). */
export type SessionSummary = {
  sessionStart: string; // ISO do início da live
  entered: number;
  reachedEnd: number;
};

/** Espectador ativo agora (último ping < 60s) — com local e aparelho. */
export type LiveViewer = {
  location: string | null; // "São Paulo, SP · BR"
  device: string | null; // Celular | Computador | Tablet
  os: string | null;
  browser: string | null;
  minutesInRoom: number;
  positionSeconds: number;
};

export type WebinarMetrics = {
  registered: number;
  // Números da sessão exibida (a live mais recente / em andamento):
  sessionStart: string | null;
  entered: number;
  watchingNow: number;
  reachedEnd: number;
  // Quem está assistindo agora (sessão atual):
  viewers: LiveViewer[];
  // Histórico por live (mais recentes primeiro):
  sessions: SessionSummary[];
};

export async function getWebinarMetrics(webinarId: string): Promise<WebinarMetrics> {
  const supabase = supabaseAdmin();

  const { data: w } = await supabase
    .from("webinars")
    .select("duration_seconds")
    .eq("id", webinarId)
    .single<{ duration_seconds: number }>();
  const duration = w?.duration_seconds ?? 0;
  const endThreshold = Math.max(0, duration - 120); // últimos 2min = "até o fim"
  const liveCutoffMs = Date.now() - 60_000; // ativo nos últimos 60s

  type Row = {
    first_seen_at: string;
    last_seen_at: string;
    last_position_seconds: number;
    session_start: string;
    minutes?: number[] | null; // ausente enquanto a 0014 não roda no banco
    country: string | null;
    region: string | null;
    city: string | null;
    device: string | null;
    os: string | null;
    browser: string | null;
  };

  const cols =
    "first_seen_at, last_seen_at, last_position_seconds, session_start, country, region, city, device, os, browser" +
    ((await hasMinutesColumn(supabase)) ? ", minutes" : "");

  const [{ count: registered }, allRows] = await Promise.all([
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("webinar_id", webinarId),
    fetchAll<Row>((from, to) =>
      supabase
        .from("watch_sessions")
        .select(cols)
        .eq("webinar_id", webinarId)
        .not("session_start", "is", null)
        .order("first_seen_at", { ascending: true })
        .range(from, to)
    ),
  ]);

  // Descarta quem só abriu a página DEPOIS da aula acabar (aba esquecida /
  // link aberto fora de hora): não é espectador, não pode virar play.
  const rows = allRows.filter((r) => withinLive(r.first_seen_at, r.session_start, duration));

  // Agrupa por início da live.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const g = groups.get(r.session_start);
    if (g) g.push(r);
    else groups.set(r.session_start, [r]);
  }

  // ISO ordena cronologicamente → mais recentes primeiro.
  const keys = [...groups.keys()].sort().reverse();
  const reachedEndOf = (rs: Row[]) =>
    duration > 0 ? rs.filter((r) => r.last_position_seconds >= endThreshold).length : 0;

  const summaries: SessionSummary[] = keys.map((k) => ({
    sessionStart: k,
    entered: groups.get(k)!.length,
    reachedEnd: reachedEndOf(groups.get(k)!),
  }));

  const latestKey = keys[0] ?? null;
  const latest = latestKey ? groups.get(latestKey)! : [];

  const locationOf = (r: Row) => {
    const place = [r.city, r.region].filter(Boolean).join(", ");
    const full = [place || null, r.country].filter(Boolean).join(" · ");
    return full || null;
  };
  const viewers: LiveViewer[] = latest
    .filter((r) => new Date(r.last_seen_at).getTime() > liveCutoffMs)
    .sort((a, b) => new Date(a.first_seen_at).getTime() - new Date(b.first_seen_at).getTime())
    .map((r) => ({
      location: locationOf(r),
      device: r.device,
      os: r.os,
      browser: r.browser,
      minutesInRoom: minutesInRoomOf(r),
      positionSeconds: r.last_position_seconds,
    }));

  return {
    registered: registered ?? 0,
    sessionStart: latestKey,
    entered: latest.length,
    watchingNow: viewers.length,
    reachedEnd: reachedEndOf(latest),
    viewers,
    sessions: summaries.slice(0, 14),
  };
}

// ---------- Relatório por live (todas as lives realizadas, área admin) ----------

/** Uma live realizada (um webinar num dia/horário específico). */
export type LiveRow = {
  webinarId: string;
  webinarTitle: string;
  slug: string;
  sessionStart: string; // ISO normalizado do início da live
  invited: number; // convidados: receberam disparo de WhatsApp no dia da live
  // Convidados que assistiram. `null` = impossível medir (aula de entrada livre:
  // ninguém se cadastra, então não há telefone pra cruzar com o disparo).
  invitedAttended: number | null;
  registered: number; // inscritos que escolheram essa live
  registeredAttended: number; // desses inscritos, quantos realmente entraram
  anonPlays: number; // plays sem cadastro (webinar de entrada livre, ex. aula-qui)
  entered: number; // espectadores distintos que abriram a sala (plays únicos)
  reachedEnd: number;
  watchingNow: number; // ativos nos últimos 60s
  isLive: boolean; // tem alguém assistindo agora
  peak: number; // pico de espectadores simultâneos
  peakAtSeconds: number | null; // em que minuto da live veio o pico
  purchases: number; // compras aprovadas (webhook Hotmart)
};

/** Retenção num ponto da live: quantos estavam presentes naquele minuto. */
export type RetentionPoint = {
  label: string; // "5 min", "Pitch", …
  atSeconds: number;
  count: number;
  pct: number | null; // % sobre os plays únicos
};

/** Ponto da curva de retenção (presença minuto a minuto, estilo VTurb). */
export type RetentionCurvePoint = {
  atSeconds: number;
  count: number;
  pct: number | null; // % sobre os plays únicos
};

/** Um espectador de uma live (inscrito ou anônimo), com local e aparelho. */
export type LiveAttendee = {
  name: string | null; // nome do inscrito (null = anônimo, entrou sem formulário)
  email: string | null;
  location: string | null; // "São Paulo, SP · BR"
  device: string | null;
  os: string | null;
  browser: string | null;
  minutesInRoom: number;
  positionSeconds: number;
  live: boolean; // ativo nos últimos 60s
};

export type LiveDetail = {
  webinarId: string;
  webinarTitle: string;
  slug: string;
  sessionStart: string;
  registered: number;
  registeredAttended: number; // inscritos que realmente entraram
  entered: number; // plays únicos (1 por navegador nesta live)
  reachedEnd: number;
  watchingNow: number;
  // Métricas avançadas:
  peakViewers: number;
  peakAtSeconds: number | null; // minuto da live em que houve o pico
  retention: RetentionPoint[]; // 5/15/30/45 min (os que couberem na duração)
  retentionCurve: RetentionCurvePoint[]; // curva minuto a minuto (gráfico)
  pitchRetention: RetentionPoint | null; // presença no momento do pitch
  offerClicks: number; // espectadores DISTINTOS que clicaram na oferta
  clickRate: number | null; // offerClicks / entered
  purchases: number; // compras aprovadas (Hotmart, transações distintas)
  purchaseRate: number | null; // purchases / entered
  revenue: number | null; // soma do valor das compras (na moeda da oferta)
  attendees: LiveAttendee[];
  byDevice: { label: string; count: number }[];
  byLocation: { label: string; count: number }[];
};

const LIVE_WINDOW_MS = 60_000; // "assistindo agora" = visto nos últimos 60s
// Folga sobre o last_seen (heartbeat é a cada ~20s): evita "sair" antes da hora.
// Só vale pras linhas ANTIGAS (sem `minutes`), onde a presença é estimada.
const PRESENCE_GRACE_MS = 45_000;
// Teto de minutos por live ao montar a curva (protege contra session_start bobo).
const MAX_LIVE_MINUTES = 24 * 60;

/** 'YYYY-MM-DD' no fuso de SP — mesma chave de dia usada nos disparos do CRM. */
function spDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ADMIN_TIMEZONE });
}

/** Normaliza um timestamptz pra ISO canônico (chave estável entre tabelas). */
function isoKey(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * A linha é de alguém que estava na aula? Quem abriu a página só DEPOIS do fim
 * (aba esquecida, link antigo) gerava heartbeat com a posição no fim do vídeo e
 * entrava como play + "até o fim". Isso não é audiência — fica de fora.
 */
function withinLive(
  firstSeenAt: string,
  sessionStart: string | null,
  durationSeconds: number
): boolean {
  if (durationSeconds <= 0) return true;
  const start = sessionStart ? new Date(sessionStart).getTime() : NaN;
  const first = new Date(firstSeenAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(first)) return true;
  return first < start + durationSeconds * 1000;
}

/** Presença de um espectador numa live. `minutes` = minutos REAIS carimbados
 *  pelo heartbeat (migration 0014); vazio = linha antiga, presença estimada. */
type Presence = { firstMs: number; lastMs: number; minutes: number[] };

function presenceOf(r: {
  first_seen_at: string;
  last_seen_at: string;
  minutes?: number[] | null;
}): Presence {
  return {
    firstMs: new Date(r.first_seen_at).getTime(),
    lastMs: new Date(r.last_seen_at).getTime(),
    minutes: r.minutes ?? [],
  };
}

/** Tempo real na sala (min): soma dos minutos assistidos; nas linhas antigas,
 *  a distância entre a 1ª e a última batida. Nunca usa "agora" — senão uma live
 *  de semanas atrás mostraria milhares de minutos. */
function minutesInRoomOf(r: {
  first_seen_at: string;
  last_seen_at: string;
  minutes?: number[] | null;
}): number {
  const mins = r.minutes ?? [];
  if (mins.length > 0) return mins.length;
  const span = new Date(r.last_seen_at).getTime() - new Date(r.first_seen_at).getTime();
  return Math.max(1, Math.round(span / 60_000));
}

/**
 * Quantos espectadores estavam presentes em CADA minuto da live.
 * Com `minutes` a conta é exata (quem saiu no minuto 10 e voltou no 50 não
 * conta no meio). Sem `minutes` (histórico), cai na estimativa por intervalo.
 */
function minuteCounts(people: Presence[], startMs: number, lastMinute: number): number[] {
  const last = Math.max(0, Math.min(lastMinute, MAX_LIVE_MINUTES));
  const counts = new Array<number>(last + 1).fill(0);
  for (const p of people) {
    if (p.minutes.length > 0) {
      for (const m of p.minutes) if (m >= 0 && m <= last) counts[m]++;
      continue;
    }
    const from = Math.max(0, Math.floor((p.firstMs - startMs) / 60_000));
    const to = Math.min(last, Math.floor((p.lastMs + PRESENCE_GRACE_MS - startMs) / 60_000));
    for (let m = from; m <= to; m++) counts[m]++;
  }
  return counts;
}

/** Pico de simultâneos (maior presença num minuto) e em que minuto foi. */
function peakOf(counts: number[]): { peak: number; atMinute: number | null } {
  let peak = 0;
  let atMinute: number | null = null;
  counts.forEach((c, m) => {
    if (c > peak) {
      peak = c;
      atMinute = m;
    }
  });
  return { peak, atMinute };
}

/** Último minuto que faz sentido olhar: o último minuto EXIBIDO do vídeo (uma
 *  aula de 60min vai do minuto 0 ao 59) ou o minuto atual, se ainda está no ar. */
function lastMinuteOf(startMs: number, durationSeconds: number, nowMs: number): number {
  const elapsedMin = Math.floor((nowMs - startMs) / 60_000);
  const durationMin =
    durationSeconds > 0 ? Math.ceil(durationSeconds / 60) - 1 : MAX_LIVE_MINUTES;
  return Math.max(0, Math.min(durationMin, elapsedMin, MAX_LIVE_MINUTES));
}

/** Lista TODAS as lives realizadas (todos os webinars), mais recentes primeiro. */
export async function getAllLives(): Promise<LiveRow[]> {
  const supabase = supabaseAdmin();
  const nowMs = Date.now();
  const liveCutoffMs = nowMs - LIVE_WINDOW_MS;

  type W = { id: string; title: string; slug: string; duration_seconds: number };
  type S = {
    webinar_id: string;
    session_start: string;
    registration_id: string | null;
    first_seen_at: string;
    last_seen_at: string;
    last_position_seconds: number;
    minutes?: number[] | null; // ausente enquanto a 0014 não roda no banco
  };
  type Reg = { id: string; webinar_id: string; scheduled_start_at: string; phone: string | null };
  type Buy = {
    id: string;
    webinar_id: string | null;
    session_start: string | null;
    transaction_id: string | null;
  };

  const withMinutes = await hasMinutesColumn(supabase);
  const sessionCols =
    "webinar_id, session_start, registration_id, first_seen_at, last_seen_at, last_position_seconds" +
    (withMinutes ? ", minutes" : "");

  const [{ data: webinars }, sessions, regs, buys, invitedByDay] = await Promise.all([
    supabase.from("webinars").select("id, title, slug, duration_seconds"),
    fetchAll<S>((from, to) =>
      supabase
        .from("watch_sessions")
        .select(sessionCols)
        .not("session_start", "is", null)
        .order("first_seen_at", { ascending: true })
        .range(from, to)
    ),
    fetchAll<Reg>((from, to) =>
      supabase
        .from("registrations")
        .select("id, webinar_id, scheduled_start_at, phone")
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
    fetchAll<Buy>((from, to) =>
      supabase
        .from("purchases")
        .select("id, webinar_id, session_start, transaction_id")
        .eq("event", "PURCHASE_APPROVED")
        .order("occurred_at", { ascending: true })
        .range(from, to)
    ),
    // CRM do webinário (outro banco): quem recebeu disparo em cada dia. É fonte
    // SECUNDÁRIA — se o CRM cair ou estiver mal configurado, as métricas da live
    // continuam de pé e só a coluna "convidados" fica vazia.
    getInvitedPhonesByDay().catch(() => ({}) as Record<string, string[]>),
  ]);

  const wmap = new Map<string, W>();
  for (const w of (webinars ?? []) as W[]) wmap.set(w.id, w);

  // inscritos por (webinar | live)
  const regCount = new Map<string, number>();
  // telefone do inscrito → id, por live (pra cruzar com os convidados do disparo)
  const regPhones = new Map<string, Map<string, string>>();
  for (const r of regs) {
    const iso = isoKey(r.scheduled_start_at);
    if (!iso) continue;
    const key = `${r.webinar_id}|${iso}`;
    regCount.set(key, (regCount.get(key) ?? 0) + 1);
    const phone = phoneKey(r.phone);
    if (phone) {
      const m = regPhones.get(key) ?? new Map<string, string>();
      m.set(phone, r.id);
      regPhones.set(key, m);
    }
  }

  const invitedSets = new Map<string, Set<string>>(
    Object.entries(invitedByDay).map(([day, phones]) => [day, new Set(phones)])
  );

  // compras aprovadas por (webinar | live) — transações distintas
  // (sem transaction_id, o id da linha evita contar o mesmo evento duas vezes)
  const buyCount = new Map<string, Set<string>>();
  for (const b of buys) {
    const iso = isoKey(b.session_start);
    if (!b.webinar_id || !iso) continue;
    const key = `${b.webinar_id}|${iso}`;
    const set = buyCount.get(key) ?? new Set<string>();
    set.add(b.transaction_id ?? `row:${b.id}`);
    buyCount.set(key, set);
  }

  const groups = new Map<string, S[]>();
  for (const s of sessions) {
    const iso = isoKey(s.session_start);
    if (!iso) continue;
    const duration = wmap.get(s.webinar_id)?.duration_seconds ?? 0;
    // aba aberta depois do fim não é audiência
    if (!withinLive(s.first_seen_at, iso, duration)) continue;
    const key = `${s.webinar_id}|${iso}`;
    const g = groups.get(key);
    if (g) g.push(s);
    else groups.set(key, [s]);
  }

  const rows: LiveRow[] = [];
  for (const [key, rs] of groups) {
    const sep = key.lastIndexOf("|");
    const webinarId = key.slice(0, sep);
    const iso = key.slice(sep + 1);
    const w = wmap.get(webinarId);
    const duration = w?.duration_seconds ?? 0;
    const endThreshold = Math.max(0, duration - 120);
    const reachedEnd =
      duration > 0 ? rs.filter((r) => r.last_position_seconds >= endThreshold).length : 0;
    const watchingNow = rs.filter((r) => new Date(r.last_seen_at).getTime() > liveCutoffMs).length;
    const startMs = new Date(iso).getTime();
    const { peak, atMinute } = peakOf(
      minuteCounts(rs.map(presenceOf), startMs, lastMinuteOf(startMs, duration, nowMs))
    );
    // --- convidados do disparo × quem apareceu ---
    // O disparo é do DIA da live (fluxos "É hoje"/"Falta 1 hora"/"Ao vivo"); o
    // cruzamento é pelo telefone do cadastro. Numa aula de entrada livre não há
    // cadastro, então dá pra saber quantos foram convidados mas NÃO quantos
    // vieram — aí `invitedAttended` fica null em vez de fingir zero.
    const invitedPhones = invitedSets.get(spDay(iso)) ?? new Set<string>();
    const phonesOfLive = regPhones.get(key);
    const attendedRegIds = new Set(rs.map((r) => r.registration_id).filter(Boolean));
    let invitedAttended: number | null = null;
    if (invitedPhones.size > 0 && phonesOfLive && phonesOfLive.size > 0) {
      invitedAttended = 0;
      for (const phone of invitedPhones) {
        const regId = phonesOfLive.get(phone);
        if (regId && attendedRegIds.has(regId)) invitedAttended++;
      }
    }

    rows.push({
      webinarId,
      webinarTitle: w?.title ?? "(webinar removido)",
      slug: w?.slug ?? "",
      sessionStart: iso,
      invited: invitedPhones.size,
      invitedAttended,
      registered: regCount.get(key) ?? 0,
      // comparecimento só é comparável assim: inscritos DISTINTOS que entraram
      // (plays ÷ inscritos daria >100% num webinar de entrada livre)
      registeredAttended: new Set(
        rs.map((r) => r.registration_id).filter((v): v is string => !!v)
      ).size,
      anonPlays: rs.filter((r) => !r.registration_id).length,
      entered: rs.length,
      reachedEnd,
      watchingNow,
      isLive: watchingNow > 0,
      peak,
      peakAtSeconds: atMinute === null ? null : (atMinute as number) * 60,
      purchases: buyCount.get(key)?.size ?? 0,
    });
  }

  // O disparo é atribuído por DIA, então duas aulas no mesmo dia receberiam os
  // mesmos convidados e o total dobraria.
  // A aula que casar mais telefones fica com eles; empate vai pra de mais
  // inscritos, depois mais plays. As outras zeram.
  const byDay = new Map<string, LiveRow[]>();
  for (const r of rows) {
    const day = spDay(r.sessionStart);
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }
  for (const sameDay of byDay.values()) {
    if (sameDay.length < 2) continue;
    const owner = [...sameDay].sort(
      (a, b) =>
        (b.invitedAttended ?? -1) - (a.invitedAttended ?? -1) ||
        b.registered - a.registered ||
        b.entered - a.entered
    )[0];
    for (const r of sameDay) {
      if (r === owner) continue;
      r.invited = 0;
      r.invitedAttended = null;
    }
  }

  rows.sort((a, b) => b.sessionStart.localeCompare(a.sessionStart));
  return rows;
}

/** Detalhe completo de UMA live (espectadores + local + aparelho). */
export async function getLiveDetail(
  webinarId: string,
  sessionStart: string
): Promise<LiveDetail | null> {
  const supabase = supabaseAdmin();
  const target = isoKey(sessionStart);
  if (!target) return null;

  const { data: w } = await supabase
    .from("webinars")
    .select("title, slug, duration_seconds")
    .eq("id", webinarId)
    .single<{ title: string; slug: string; duration_seconds: number }>();
  if (!w) return null;

  const duration = w.duration_seconds ?? 0;
  const endThreshold = Math.max(0, duration - 120);
  const liveCutoffMs = Date.now() - LIVE_WINDOW_MS;
  const nowMs = Date.now();

  type Row = {
    registration_id: string | null;
    first_seen_at: string;
    last_seen_at: string;
    last_position_seconds: number;
    session_start: string;
    minutes?: number[] | null; // ausente enquanto a 0014 não roda no banco
    country: string | null;
    region: string | null;
    city: string | null;
    device: string | null;
    os: string | null;
    browser: string | null;
  };
  type Reg = { id: string; name: string; email: string; scheduled_start_at: string };
  type Click = { viewer_key: string; session_start: string | null };
  type BuyRow = {
    id: string;
    session_start: string | null;
    transaction_id: string | null;
    price_value: number | null;
  };

  const detailCols =
    "registration_id, first_seen_at, last_seen_at, last_position_seconds, session_start, country, region, city, device, os, browser" +
    ((await hasMinutesColumn(supabase)) ? ", minutes" : "");

  const [sessionRows, regList, { data: offerRows }, clickRows, buyRows] = await Promise.all([
    fetchAll<Row>((from, to) =>
      supabase
        .from("watch_sessions")
        .select(detailCols)
        .eq("webinar_id", webinarId)
        .order("first_seen_at", { ascending: true })
        .range(from, to)
    ),
    fetchAll<Reg>((from, to) =>
      supabase
        .from("registrations")
        .select("id, name, email, scheduled_start_at")
        .eq("webinar_id", webinarId)
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
    supabase
      .from("offers")
      .select("pitch_start_seconds, show_at_seconds")
      .eq("webinar_id", webinarId)
      .order("show_at_seconds", { ascending: true }),
    fetchAll<Click>((from, to) =>
      supabase
        .from("offer_clicks")
        .select("viewer_key, session_start")
        .eq("webinar_id", webinarId)
        .order("clicked_at", { ascending: true })
        .range(from, to)
    ),
    fetchAll<BuyRow>((from, to) =>
      supabase
        .from("purchases")
        .select("id, session_start, transaction_id, price_value")
        .eq("webinar_id", webinarId)
        .eq("event", "PURCHASE_APPROVED")
        .order("occurred_at", { ascending: true })
        .range(from, to)
    ),
  ]);

  const regById = new Map<string, Reg>();
  for (const r of regList) regById.set(r.id, r);

  const rows = sessionRows.filter(
    (r) => isoKey(r.session_start) === target && withinLive(r.first_seen_at, target, duration)
  );
  const registered = regList.filter((r) => isoKey(r.scheduled_start_at) === target).length;

  const locationOf = (r: Row) => {
    const place = [r.city, r.region].filter(Boolean).join(", ");
    const full = [place || null, r.country].filter(Boolean).join(" · ");
    return full || null;
  };

  const attendees: LiveAttendee[] = rows
    .sort((a, b) => new Date(a.first_seen_at).getTime() - new Date(b.first_seen_at).getTime())
    .map((r) => {
      const reg = r.registration_id ? regById.get(r.registration_id) : undefined;
      return {
        name: reg?.name?.trim() || null,
        email: reg?.email?.trim() || null,
        location: locationOf(r),
        device: r.device,
        os: r.os,
        browser: r.browser,
        minutesInRoom: minutesInRoomOf(r),
        positionSeconds: r.last_position_seconds,
        live: new Date(r.last_seen_at).getTime() > liveCutoffMs,
      };
    });

  // agregações
  const tally = (items: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const it of items) {
      const label = it && it.trim() ? it.trim() : "Desconhecido";
      m.set(label, (m.get(label) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  // ---- Métricas avançadas (presença REAL minuto a minuto) ----
  const startMs = new Date(target).getTime();
  const lastMinute = lastMinuteOf(startMs, duration, nowMs);
  const counts = minuteCounts(rows.map(presenceOf), startMs, lastMinute);
  const presentAtSecond = (s: number) => counts[Math.min(Math.floor(s / 60), lastMinute)] ?? 0;
  const entered = rows.length;
  const pctOf = (n: number) => (entered > 0 ? Math.round((n / entered) * 100) : null);

  const { peak, atMinute } = peakOf(counts);

  const checkpoints = [300, 900, 1800, 2700].filter((s) => duration === 0 || s < duration);
  const retention: RetentionPoint[] = checkpoints.map((s) => {
    const count = presentAtSecond(s);
    return { label: `${s / 60} min`, atSeconds: s, count, pct: pctOf(count) };
  });

  // Curva de retenção (estilo VTurb): presença minuto a minuto do início da live
  // até o fim (ou até agora, se ela ainda estiver rolando).
  const curveEndS = lastMinute * 60;
  const curveStepS = curveEndS > 7200 ? 120 : 60; // +2h de live → ponto a cada 2 min
  const retentionCurve: RetentionCurvePoint[] = [];
  if (entered > 0 && curveEndS >= curveStepS) {
    for (let s = 0; s <= curveEndS; s += curveStepS) {
      const count = presentAtSecond(s);
      retentionCurve.push({ atSeconds: s, count, pct: pctOf(count) });
    }
    if (retentionCurve[retentionCurve.length - 1].atSeconds !== curveEndS) {
      retentionCurve.push({
        atSeconds: curveEndS,
        count: presentAtSecond(curveEndS),
        pct: pctOf(presentAtSecond(curveEndS)),
      });
    }
  }

  // Pitch = pitch_start_seconds da 1ª oferta que tiver (fallback: show_at).
  type OfferRow = { pitch_start_seconds: number | null; show_at_seconds: number };
  const offer = ((offerRows ?? []) as OfferRow[]).find(
    (o) => o.pitch_start_seconds != null || o.show_at_seconds > 0
  );
  const pitchAt = offer ? (offer.pitch_start_seconds ?? offer.show_at_seconds) : null;
  const pitchRetention: RetentionPoint | null =
    pitchAt != null
      ? (() => {
          const count = presentAtSecond(pitchAt);
          return { label: "Pitch", atSeconds: pitchAt, count, pct: pctOf(count) };
        })()
      : null;

  // Conversão: espectadores distintos que clicaram no CTA nesta live.
  const clickers = new Set(
    clickRows.filter((c) => isoKey(c.session_start) === target).map((c) => c.viewer_key)
  );
  const offerClicks = clickers.size;

  // Compras reais (Hotmart): transações distintas desta live + receita.
  const liveBuys = buyRows.filter((b) => isoKey(b.session_start) === target);
  const txSeen = new Set<string>();
  let purchases = 0;
  let revenue = 0;
  let hasRevenue = false;
  for (const b of liveBuys) {
    const tx = b.transaction_id ?? `row:${b.id}`;
    if (txSeen.has(tx)) continue;
    txSeen.add(tx);
    purchases++;
    if (b.price_value != null) {
      revenue += Number(b.price_value);
      hasRevenue = true;
    }
  }

  return {
    webinarId,
    webinarTitle: w.title,
    slug: w.slug,
    sessionStart: target,
    registered,
    registeredAttended: new Set(
      rows.map((r) => r.registration_id).filter((v): v is string => !!v)
    ).size,
    entered,
    reachedEnd:
      duration > 0 ? rows.filter((r) => r.last_position_seconds >= endThreshold).length : 0,
    watchingNow: attendees.filter((a) => a.live).length,
    peakViewers: peak,
    peakAtSeconds: atMinute != null ? atMinute * 60 : null,
    retention,
    retentionCurve,
    pitchRetention,
    offerClicks,
    clickRate: entered > 0 ? Math.round((offerClicks / entered) * 100) : null,
    purchases,
    purchaseRate: entered > 0 ? Math.round((purchases / entered) * 100) : null,
    revenue: hasRevenue ? revenue : null,
    attendees,
    byDevice: tally(attendees.map((a) => a.device)),
    byLocation: tally(attendees.map((a) => a.location)),
  };
}

// ---------- Estado "ao vivo agora" da lista de webinars ----------

/** Por webinar: se a sala está aberta agora e quantos assistem em tempo real. */
export type LiveWatchState = Record<string, { watching: number; isLive: boolean }>;

/**
 * Para cada webinar ATIVO: `isLive` = existe uma sessão em andamento agora
 * (janela recorrente/horário aberta), `watching` = espectadores com heartbeat
 * nos últimos 60s. Uma consulta só pra toda a lista — usada pelo selo 🔴 AO VIVO.
 */
export async function getLiveWatchState(): Promise<LiveWatchState> {
  const supabase = supabaseAdmin();
  const now = Date.now();
  const cutoff = new Date(now - 60_000).toISOString(); // ativo nos últimos 60s

  const [{ data: webinars }, { data: active }] = await Promise.all([
    supabase.from("webinars").select("*").eq("status", "active").returns<Webinar[]>(),
    supabase
      .from("watch_sessions")
      .select("webinar_id")
      .gt("last_seen_at", cutoff)
      .returns<{ webinar_id: string }[]>(),
  ]);

  const counts = new Map<string, number>();
  for (const r of active ?? []) counts.set(r.webinar_id, (counts.get(r.webinar_id) ?? 0) + 1);

  const out: LiveWatchState = {};
  for (const w of webinars ?? []) {
    // nextSessionStart devolve o menor início que ainda não encerrou; se já
    // começou (<= agora), a sessão está em andamento = ao vivo.
    const start = nextSessionStart(w, now).getTime();
    out[w.id] = { watching: counts.get(w.id) ?? 0, isLive: start <= now };
  }
  return out;
}
