import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "webinar-images";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const key = path.join("/");

  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(key);
  if (error || !data) return new Response("Imagem não encontrada", { status: 404 });

  return new Response(data, {
    headers: {
      "content-type": data.type || "image/png",
      "cache-control": "public, max-age=3600",
    },
  });
}
