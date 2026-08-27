import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "webinar-videos";

/**
 * Proxy de streaming do vídeo. O navegador do espectador só fala com a nossa
 * origem; o objeto vem do Storage privado autenticado com a service_role.
 * Encaminha o header Range pra permitir seek e o seek do simulated-live.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = supabaseAdmin();
  const { data: w } = await supabase
    .from("webinars")
    .select("video_path")
    .eq("id", id)
    .single();

  if (!w?.video_path) return new Response("Vídeo não encontrado", { status: 404 });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const objectUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${w.video_path}`;
  const range = request.headers.get("range");

  const upstream = await fetch(objectUrl, {
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      ...(range ? { Range: range } : {}),
    },
    cache: "no-store",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Falha ao carregar o vídeo", { status: upstream.status });
  }

  const headers = new Headers();
  for (const h of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  if (!headers.has("content-type")) headers.set("content-type", "video/mp4");
  headers.set("cache-control", "private, max-age=0, no-store");

  return new Response(upstream.body, { status: upstream.status, headers });
}
