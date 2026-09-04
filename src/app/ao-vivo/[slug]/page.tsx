import { notFound } from "next/navigation";
import { PublicWebinarRoom } from "@/components/PublicWebinarRoom";
import { getActiveSingleWebinarRoom, singleWebinarStartAt } from "@/lib/public-webinar";

export const dynamic = "force-dynamic";

/** Destino da entrada direta quando a transmissão única já está em andamento. */
export default async function LiveWebinarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await getActiveSingleWebinarRoom(slug);
  if (!room) notFound();

  return <PublicWebinarRoom {...room} scheduledStartAtIso={singleWebinarStartAt(room.webinar)} />;
}
