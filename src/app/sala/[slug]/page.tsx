import { notFound } from "next/navigation";
import { PublicWebinarRoom } from "@/components/PublicWebinarRoom";
import { getActiveSingleWebinarRoom, singleWebinarStartAt } from "@/lib/public-webinar";

// A sala muda de contagem para transmissão no horário da aula.
export const dynamic = "force-dynamic";

export default async function WaitingRoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await getActiveSingleWebinarRoom(slug);
  if (!room) notFound();

  return <PublicWebinarRoom {...room} scheduledStartAtIso={singleWebinarStartAt(room.webinar)} />;
}
