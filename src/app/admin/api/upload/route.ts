import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "webinar-videos";

export async function POST(request: Request) {
  const form = await request.formData();
  const webinarId = String(form.get("webinarId") ?? "");
  const file = form.get("file");

  if (!webinarId || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `${webinarId}/${Date.now()}.${ext || "mp4"}`;

  const supabase = supabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
    contentType: file.type || "video/mp4",
    upsert: true,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("webinars").update({ video_path: key }).eq("id", webinarId);
  return NextResponse.json({ ok: true, path: key });
}
