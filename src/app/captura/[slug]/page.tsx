import { notFound } from "next/navigation";
import { CaptureLanding } from "@/components/CaptureLanding";
import { getActiveSingleWebinar } from "@/lib/public-webinar";

export const dynamic = "force-dynamic";

/** Página de captura com URL própria para campanhas e anúncios. */
export default async function CapturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const webinar = await getActiveSingleWebinar(slug);
  if (!webinar) notFound();

  return <CaptureLanding webinar={webinar} />;
}
