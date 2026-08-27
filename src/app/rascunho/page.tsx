import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { RascunhoReal } from "./_RascunhoReal";
import { resolveVideoUrl } from "@/lib/video-source";
import type { Webinar, ChatMessage, Offer, SalesNotification } from "@/types/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rascunho local — telas do lead",
  robots: { index: false, follow: false },
};

type Tela = "cadastro" | "contagem" | "aovivo" | "encerrada";
const TELAS: Tela[] = ["cadastro", "contagem", "aovivo", "encerrada"];

/** Revisão local das 4 telas do lead com os dados reais do banco.
 *  `?slug=aula-qui` escolhe o webinar, `?tela=aovivo` abre numa tela e
 *  `?modo=escuro` liga o tema escuro. */
export default async function RascunhoPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; tela?: string; modo?: string }>;
}) {
  const { slug, tela, modo } = await searchParams;
  const supabase = supabaseAdmin();

  const q = supabase.from("webinars").select("*").eq("status", "active");
  const { data: webinars } = await (slug ? q.eq("slug", slug) : q).limit(1).returns<Webinar[]>();
  const webinar = webinars?.[0];
  if (!webinar) notFound();

  const [{ data: messages }, { data: offers }, { data: sales }] = await Promise.all([
    supabase.from("chat_messages").select("*").eq("webinar_id", webinar.id).order("at_seconds"),
    supabase.from("offers").select("*").eq("webinar_id", webinar.id).order("show_at_seconds"),
    supabase.from("sales_notifications").select("*").eq("webinar_id", webinar.id).order("at_seconds"),
  ]);

  const videoUrl = resolveVideoUrl(webinar);

  return (
    <RascunhoReal
      webinar={webinar}
      videoUrl={videoUrl}
      messages={(messages ?? []) as ChatMessage[]}
      offers={(offers ?? []) as Offer[]}
      sales={(sales ?? []) as SalesNotification[]}
      telaInicial={TELAS.find((t) => t === tela)}
      escuroInicial={modo === "escuro"}
    />
  );
}
