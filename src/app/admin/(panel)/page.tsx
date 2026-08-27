import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createWebinar, duplicateWebinar, getLiveWatchState } from "@/app/admin/actions";
import { Icon } from "@/components/Icon";
import { displayTitle } from "@/components/Brand";
import type { Webinar } from "@/types/db";
import { LiveWatchProvider, LiveBadge } from "./_LiveWatch";

export const dynamic = "force-dynamic";

/** Segundos → "1h18" / "48min" / "45s" (legível, não "4680s"). */
function fmtDuration(total: number) {
  if (!total || total <= 0) return "—";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m}min`;
  return `${total}s`;
}

function TypeBadge({ type }: { type: Webinar["type"] }) {
  const jit = type === "just_in_time";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
        jit
          ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
          : "border-slate-700 bg-slate-800/50 text-slate-300"
      }`}
    >
      {jit ? "Just in Time" : "Único"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25"
          : "bg-slate-800/60 text-slate-400 ring-1 ring-slate-700/60"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}
      />
      {active ? "Ativo" : "Rascunho"}
    </span>
  );
}

const actionBtn =
  "grid place-items-center h-9 w-9 rounded-lg border border-slate-700/70 text-slate-300 transition hover:border-[#cbad78]/70 hover:bg-[#cbad78]/10 hover:text-[#e3cfa0]";

export default async function AdminWebinarsPage() {
  const supabase = supabaseAdmin();
  const { data: webinars } = await supabase
    .from("webinars")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Webinar[]>();

  const list = webinars ?? [];
  const activeCount = list.filter((w) => w.status === "active").length;
  const liveState = await getLiveWatchState();
  const liveNowCount = Object.values(liveState).filter((s) => s.isLive).length;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Webinars</h1>
          <p className="text-sm text-slate-500 mt-1">
            {list.length} {list.length === 1 ? "transmissão" : "transmissões"}
            {activeCount > 0 && (
              <>
                {" · "}
                <span className="text-emerald-400">{activeCount} ativa{activeCount === 1 ? "" : "s"}</span>
              </>
            )}
            {liveNowCount > 0 && (
              <>
                {" · "}
                <span className="font-medium text-red-400">
                  🔴 {liveNowCount} ao vivo agora
                </span>
              </>
            )}
          </p>
        </div>
        <form action={createWebinar}>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[#d9bd8a] to-[#c3a267] hover:from-[#e3cfa0] hover:to-[#cbad78] px-4 py-2.5 font-semibold text-[#241708] shadow-md shadow-emerald-900/30 transition active:scale-[0.98]">
            <Icon name="plus" size={17} /> Criar novo
          </button>
        </form>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-6 py-16 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-slate-800/60 text-slate-500">
            <Icon name="video" size={24} />
          </div>
          <p className="text-slate-300 font-medium">Nenhum webinar ainda</p>
          <p className="text-sm text-slate-500 mt-1">Clique em “Criar novo” para começar.</p>
        </div>
      ) : (
        <LiveWatchProvider initial={liveState}>
        <div className="grid gap-3">
          {list.map((w) => (
            <div
              key={w.id}
              className="group flex items-center gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 shadow-sm shadow-black/10 transition hover:border-slate-700 hover:bg-slate-900/70"
            >
              <Link
                href={`/admin/webinars/${w.id}`}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#cbad78]/25 to-emerald-500/10 text-[#cbad78] ring-1 ring-white/5 transition group-hover:from-[#cbad78]/35"
              >
                <Icon name="video" size={22} />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/webinars/${w.id}`}
                  className="block truncate font-semibold text-white transition hover:text-[#cbad78]"
                >
                  {displayTitle(w.title)}
                </Link>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="truncate">/{w.slug}</span>
                  <span className="text-slate-700">·</span>
                  <span className="whitespace-nowrap">{fmtDuration(w.duration_seconds)}</span>
                </p>
              </div>

              <LiveBadge webinarId={w.id} />

              <div className="hidden items-center gap-2 sm:flex">
                <StatusBadge status={w.status} />
                <TypeBadge type={w.type} />
              </div>

              <div className="flex items-center gap-2">
                <Link href={`/${w.slug}`} target="_blank" className={actionBtn} title="Abrir página de inscrição">
                  <Icon name="globe" size={16} />
                </Link>
                <Link href={`/admin/webinars/${w.id}`} className={actionBtn} title="Editar">
                  <Icon name="edit" size={16} />
                </Link>
                <form action={duplicateWebinar}>
                  <input type="hidden" name="id" value={w.id} />
                  <button className={actionBtn} title="Duplicar">
                    <Icon name="copy" size={16} />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
        </LiveWatchProvider>
      )}
    </div>
  );
}
