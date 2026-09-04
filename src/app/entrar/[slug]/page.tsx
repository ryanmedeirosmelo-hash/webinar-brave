import { notFound, redirect } from "next/navigation";
import { getActiveSingleWebinar, isSingleWebinarLive } from "@/lib/public-webinar";

// A decisão precisa ser feita a cada clique no link, nunca em HTML cacheado.
export const dynamic = "force-dynamic";

/**
 * Link distribuível sem cadastro. Antes do início leva à sala; durante a aula,
 * abre a transmissão já sincronizada no ponto atual.
 */
export default async function DirectEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const webinar = await getActiveSingleWebinar(slug);
  if (!webinar) notFound();

  redirect(isSingleWebinarLive(webinar) ? `/ao-vivo/${slug}` : `/sala/${slug}`);
}
