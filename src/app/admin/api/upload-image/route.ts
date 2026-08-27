import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "webinar-images";

export async function POST(request: Request) {
  const form = await request.formData();
  const webinarId = String(form.get("webinarId") ?? "geral");
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `${webinarId}/${Date.now()}.${ext || "png"}`;

  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(key, file, {
    contentType: file.type || "image/png",
    upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // servimos via proxy /img/<key> (funciona no acesso remoto e em produção)
  return NextResponse.json({ ok: true, url: `/img/${key}` });
}
