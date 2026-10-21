import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unavailable = (status = 404) => new NextResponse("Este teste não está disponível para novos acessos. Consulte quem compartilhou o link.", {
    status, headers: { "Cache-Control": "private, no-store" },
  });
  if (!z.uuid().safeParse(id).success) return unavailable();
  // HEAD and link prefetches must never enroll visitors or affect the report.
  if (request.headers.get("purpose") === "prefetch" || request.headers.get("sec-purpose")?.includes("prefetch"))
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  const cookieName = `ab_${id}`;
  const stored = request.cookies.get(cookieName)?.value;
  const visitor = z.uuid().safeParse(stored).success ? stored! : randomUUID();
  const { data: slug, error } = await supabaseAdmin().rpc("assign_webinar_ab", { p_test_id: id, p_visitor_id: visitor });
  if (error) { console.error("AB assignment failed", error.code); return unavailable(503); }
  if (!slug || typeof slug !== "string") return unavailable();
  const target = request.nextUrl.clone();
  target.pathname = `/${encodeURIComponent(slug)}`;
  const response = NextResponse.redirect(target, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  response.cookies.set(cookieName, visitor, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: `/ab/${id}`, maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export async function HEAD() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
}
