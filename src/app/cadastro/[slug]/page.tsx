import { notFound } from "next/navigation";
import { CaptureLanding } from "@/components/CaptureLanding";
import { getActiveSingleWebinar } from "@/lib/public-webinar";

export const dynamic = "force-dynamic";

/** Página estável de cadastro, independente da configuração da sala de espera. */
export default async function RegistrationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const webinar = await getActiveSingleWebinar(slug);
  if (!webinar) notFound();

  return <CaptureLanding webinar={webinar} />;
}
