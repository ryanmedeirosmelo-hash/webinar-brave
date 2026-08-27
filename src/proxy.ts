import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "aw_admin";

/**
 * Dois "lados" do produto podem morar em domínios diferentes:
 *   Área 1 (painel/admin)  → ADMIN_HOST   ex.: painel.seudominio.com
 *   Área 2 (lead assiste)  → LEADS_HOST   ex.: aula.seudominio.com
 *
 * Nada disso é obrigatório: sem as envs, tudo roda num domínio só e o proxy
 * cuida apenas da sessão do /admin.
 */
const host = (v: string | undefined) => v?.trim().toLowerCase() || null;

const ADMIN_HOST = host(process.env.ADMIN_HOST);
const LEADS_HOST = host(process.env.LEADS_HOST);

/** Domínios que só redirecionam pro host de leads (ex.: apex e www). */
const REDIRECT_TO_LEADS = new Set(
  (process.env.REDIRECT_TO_LEADS_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

/** Mantém o path e a query, trocando só o domínio. */
function toHost(request: NextRequest, target: string) {
  const url = request.nextUrl.clone();
  url.host = target;
  url.protocol = "https:";
  url.port = "";
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const reqHost = (request.headers.get("host") ?? "").toLowerCase();

  // 1. Domínios "de entrada" (apex/www) mandam tudo pro host de leads.
  if (LEADS_HOST && REDIRECT_TO_LEADS.has(reqHost)) {
    return toHost(request, LEADS_HOST);
  }

  // 2. Fora de /admin não há nada a fazer no proxy.
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // 3. /admin só existe na Área 1. No host de leads, manda pro painel.
  if (ADMIN_HOST && LEADS_HOST && reqHost === LEADS_HOST) {
    return toHost(request, ADMIN_HOST);
  }

  // 4. A própria tela de login é pública.
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  // 5. Demais rotas de /admin exigem sessão válida.
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token && token === process.env.ADMIN_SESSION_TOKEN) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Roda em todas as rotas (pra pegar o apex em `/`), exceto assets, API e mídia.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|img/|v/).*)"],
};
