import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { data, error } = await supabaseAdmin().from("webinars").select("id,title,internal_name,status").order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar os webinars.");
  return <div className="mx-auto max-w-5xl p-5 md:p-8"><h1 className="text-2xl font-bold text-white">Audiência ao vivo</h1><p className="mt-2 text-sm text-slate-400">Escolha um webinar para acompanhar quem está assistindo e de onde vêm os acessos.</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{data?.map(w => <Link key={w.id} href={`/admin/ao-vivo/${w.id}`} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-[#cbad78] focus-visible:outline-2 focus-visible:outline-[#cbad78]"><h2 className="font-semibold text-white">{w.internal_name || w.title}</h2><p className="mt-2 text-sm text-slate-400">{w.status === "active" ? "Publicado" : "Rascunho"} · Abrir acompanhamento →</p></Link>)}</div>{!data?.length && <p className="mt-6 text-sm text-slate-400">Crie um webinar para acompanhar a audiência.</p>}</div>;
}
