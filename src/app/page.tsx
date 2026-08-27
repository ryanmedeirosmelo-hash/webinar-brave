import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Brand, displayTitle, hexToRgba } from "@/components/Brand";

export const dynamic = "force-dynamic";

type Row = {
  slug: string;
  title: string;
  logo_url: string | null;
  capture_button_color: string | null;
  presenter_name: string | null;
  recurrence_days: number[] | null;
  available_times: string[] | null;
};

const DOW = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

/** "Toda segunda · 19:15" / "Segunda e quinta · 19:15" / "Às 19:15". */
function scheduleLabel(w: Row): string | null {
  const time = Array.isArray(w.available_times) && w.available_times[0] ? w.available_times[0] : null;
  const days = (w.recurrence_days ?? []).map((d) => DOW[d]).filter(Boolean);
  if (days.length && time) {
    if (days.length >= 6) return `Todos os dias · ${time}`;
    const txt =
      days.length > 1 ? `${days.slice(0, -1).join(", ")} e ${days[days.length - 1]}` : days[0];
    return `${days.length > 1 ? "" : "Toda "}${txt} · ${time}`;
  }
  return time ? `Às ${time}` : null;
}

// A raiz não é uma página de produto — ela leva pro(s) webinar(s) ativo(s).
export default async function Home() {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("webinars")
    .select(
      "slug, title, logo_url, capture_button_color, presenter_name, recurrence_days, available_times"
    )
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const webinars = (data ?? []) as Row[];

  // 1 webinar ativo → vai direto pra inscrição.
  if (webinars.length === 1) {
    redirect(`/${webinars[0].slug}`);
  }

  const brand = webinars[0];
  const accent = brand?.capture_button_color || "#cbad78";

  // Vários ativos → deixa o lead escolher a sessão.
  if (webinars.length > 1) {
    return (
      <main className="lead-theme relative min-h-dvh">
        {/* luzes do estúdio */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 right-[15%] h-[26rem] w-[26rem] rounded-full blur-3xl bg-red-600/15" />
          <div
            className="absolute -bottom-56 -left-32 h-[30rem] w-[30rem] rounded-full blur-3xl"
            style={{ backgroundColor: hexToRgba(accent, 0.14) }}
          />
        </div>

        <div className="relative mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-10">
          <header className="flex justify-center">
            <Brand
              logoUrl={brand?.logo_url}
              name={brand?.presenter_name || "Aula ao vivo"}
              accent={accent}
              size="md"
            />
          </header>

          <div className="flex flex-1 flex-col justify-center gap-6 py-10">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3.5 py-1.5 text-sm font-bold uppercase tracking-wide text-red-300 ring-1 ring-red-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                Aulas ao vivo
              </span>
              <h1 className="font-display mt-4 text-3xl font-bold text-white">
                Escolha sua sessão
              </h1>
              <p className="mt-1.5 text-slate-400">Entre na sala do dia que você participa.</p>
            </div>

            <ul className="space-y-3">
              {webinars.map((w) => {
                const schedule = scheduleLabel(w);
                return (
                  <li key={w.slug}>
                    <Link
                      href={`/${w.slug}`}
                      className="glass group flex items-center gap-4 rounded-2xl px-5 py-4 transition hover:bg-white/[0.07]"
                      style={{ boxShadow: `0 12px 40px -18px ${hexToRgba(accent, 0.5)}` }}
                    >
                      <div className="min-w-0 flex-1">
                        {schedule && (
                          <p
                            className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: accent }}
                          >
                            {schedule}
                          </p>
                        )}
                        <p className="mt-0.5 truncate font-semibold text-white">
                          {displayTitle(w.title)}
                        </p>
                      </div>
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold transition group-hover:scale-110"
                        style={{ backgroundColor: hexToRgba(accent, 0.15), color: accent }}
                      >
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </main>
    );
  }

  // Nenhum webinar ativo → mensagem neutra (sem placeholder de produto).
  return (
    <main className="lead-theme grid min-h-dvh place-items-center px-6 py-16 text-center">
      <p className="text-slate-400">Nenhuma sessão disponível no momento.</p>
    </main>
  );
}
