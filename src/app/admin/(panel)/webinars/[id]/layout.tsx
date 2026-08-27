import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deleteWebinar } from "@/app/admin/actions";
import { Icon } from "@/components/Icon";
import { displayTitle } from "@/components/Brand";
import { Stepper } from "./_Stepper";

export default async function WebinarWizardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: w } = await supabaseAdmin()
    .from("webinars")
    .select("id, internal_name, title, slug")
    .eq("id", id)
    .single();
  if (!w) notFound();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-[#cbad78] transition"
          >
            ← Webinars
          </Link>
          <h1 className="text-xl font-bold text-white mt-1 tracking-tight">
            {w.internal_name || displayTitle(w.title)}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${w.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 px-3 py-2 text-sm text-slate-300 hover:border-[#cbad78]/70 hover:bg-[#cbad78]/10 transition"
          >
            <Icon name="external" size={15} /> Ver página
          </Link>
          <form action={deleteWebinar}>
            <input type="hidden" name="id" value={w.id} />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 transition">
              <Icon name="trash" size={15} /> Excluir
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 py-5 mb-6 shadow-lg shadow-black/20">
        <Stepper webinarId={w.id} />
      </div>

      {children}
    </div>
  );
}
