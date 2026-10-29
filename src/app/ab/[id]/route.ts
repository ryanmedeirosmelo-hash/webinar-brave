import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { abDestinationPath, isABPage } from "@/lib/ab-links";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unavailable = (status = 404) => new NextResponse("Este teste não está disponível para novos acessos. Consulte quem compartilhou o link.", {
    status, headers: { "Cache-Control": "private, no-store" },
  });
  const page = request.nextUrl.searchParams.get("pagina") ?? "principal";
  if (!isABPage(page)) return unavailable();
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return unavailable();
  // HEAD and link prefetches must never enroll visitors or affect the report.
  if (request.headers.get("purpose") === "prefetch" || request.headers.get("sec-purpose")?.includes("prefetch"))
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  const db = supabaseAdmin();
  const isId = z.uuid().safeParse(id).success;
  let testId = id;
  if (!isId) {
    const { data: test, error: lookupError } = await db.from("webinar_ab_tests").select("id").eq("slug", id).maybeSingle();
    if (lookupError) return unavailable(503);
    if (!test) return unavailable();
    testId = test.id;
    // Pass through the legacy UUID path so its existing cookie can be migrated.
    const canonical = request.nextUrl.clone();
    canonical.pathname = `/ab/${testId}`;
    const response = NextResponse.redirect(canonical, 302);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  // The UUID and friendly links share one cookie and one assignment across all pages.
  const cookieName = `ab_${testId}`;
  const stored = request.headers.get("cookie")?.split(";").map(c => c.trim()).filter(c => c.startsWith(`${cookieName}=`)).map(c => c.slice(cookieName.length + 1)).find(value => z.uuid().safeParse(value).success);
  const visitor = z.uuid().safeParse(stored).success ? stored! : randomUUID();
  const { data: slug, error } = await db.rpc("assign_webinar_ab", { p_test_id: testId, p_visitor_id: visitor });
  if (error) { console.error("AB assignment failed", error.code); return unavailable(503); }
  if (!slug || typeof slug !== "string") return unavailable();
  const target = request.nextUrl.clone();
  target.pathname = abDestinationPath(slug, page);
  target.searchParams.delete("pagina");
  const response = NextResponse.redirect(target, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  response.cookies.set(cookieName, visitor, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/ab", maxAge: 60 * 60 * 24 * 365 });
  response.headers.append("Set-Cookie", `${cookieName}=; Path=/ab/${testId}; Max-Age=0; HttpOnly; SameSite=Lax${request.nextUrl.protocol === "https:" ? "; Secure" : ""}`);
  return response;
}

export async function HEAD() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
}
