"use server";

import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseClientInfo } from "@/lib/client-info";

/** Anexa localização + aparelho (não-nulos) à linha de upsert. */
async function withClientInfo(row: Record<string, unknown>) {
  const info = parseClientInfo(await headers());
  for (const [k, v] of Object.entries(info)) if (v) row[k] = v;
  return row;
}

/**
 * Grava uma batida de presença.
 *
 * Caminho normal: RPC `record_watch_beat` (migration 0014) — carimba o MINUTO
 * da live (presença real, sem supor que quem entrou ficou) e mantém a posição
 * monotônica (heartbeat atrasado não derruba o "até o fim").
 *
 * Se a função ainda não existir no banco (deploy antes da migration), cai no
 * upsert antigo — as métricas continuam sendo gravadas, só sem o minuto.
 */
async function writeBeat(row: Record<string, unknown>, positionSeconds: number) {
  const supabase = supabaseAdmin();
  const full = await withClientInfo(row);
  // A função lê `position_seconds`/`minute`; o upsert legado usa as colunas.
  const payload = {
    ...full,
    position_seconds: positionSeconds,
    minute: Math.floor(positionSeconds / 60),
  };

  const { error } = await supabase.rpc("record_watch_beat", { p: payload });
  if (!error) return;

  // fallback (função ausente): upsert direto, como antes.
  const legacy = { ...full, last_seen_at: new Date().toISOString() };
  await supabase.from("watch_sessions").upsert(legacy, { onConflict: "viewer_key" });
}

/**
 * Recupera o ponto mais avançado salvo para o link da inscrição.
 *
 * O token é a própria credencial do link privado; por isso só retornamos o
 * progresso vinculado a ele. O player também mantém uma cópia local para que
 * um fechamento repentino da aba não faça a pessoa perder os últimos segundos.
 */
export async function getRecordedPlaybackPosition(token: string): Promise<number> {
  if (!token) return 0;

  const supabase = supabaseAdmin();
  const { data: reg } = await supabase
    .from("registrations")
    .select("id, scheduled_start_at")
    .eq("access_token", token)
    .single<{ id: string; scheduled_start_at: string }>();

  if (!reg) return 0;

  const { data: session } = await supabase
    .from("watch_sessions")
    .select("last_position_seconds")
    .eq("viewer_key", `${reg.id}:${reg.scheduled_start_at}`)
    .maybeSingle<{ last_position_seconds: number | null }>();

  return Math.max(0, Math.floor(session?.last_position_seconds ?? 0));
}

/** Player chama a cada ~20s com a posição atual (s). Idempotente.
 *  `sessionStartIso` separa as métricas por live (cada dia/horário) — quando
 *  ausente (cliente antigo), cai no modo acumulado por viewer. */
export async function recordHeartbeat(
  token: string,
  positionSeconds: number,
  sessionStartIso?: string
) {
  if (!token) return;
  const supabase = supabaseAdmin();

  const { data: reg } = await supabase
    .from("registrations")
    .select("id, webinar_id")
    .eq("access_token", token)
    .single();
  if (!reg) return;

  const pos = Math.max(0, Math.floor(positionSeconds || 0));
  const session = sessionStartIso || null;
  const row: Record<string, unknown> = {
    viewer_key: session ? `${reg.id}:${session}` : reg.id,
    registration_id: reg.id,
    webinar_id: reg.webinar_id,
    last_position_seconds: pos,
  };
  if (session) row.session_start = session; // sem sessão: não mexe na coluna
  await writeBeat(row, pos);
}

/** Espectador SEM inscrição (link público / sala de espera na landing).
 *  Identificado por um id de navegador estável. Idempotente. */
export async function recordAnonHeartbeat(
  webinarId: string,
  anonId: string,
  positionSeconds: number,
  sessionStartIso?: string
) {
  if (!webinarId || !anonId) return;

  const pos = Math.max(0, Math.floor(positionSeconds || 0));
  const session = sessionStartIso || null;
  const row: Record<string, unknown> = {
    viewer_key: session ? `anon:${anonId}:${session}` : `anon:${anonId}`,
    anon_id: anonId,
    webinar_id: webinarId,
    last_position_seconds: pos,
  };
  if (session) row.session_start = session;
  await writeBeat(row, pos);
}
