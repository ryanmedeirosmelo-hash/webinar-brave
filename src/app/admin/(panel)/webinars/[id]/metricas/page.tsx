import { getWebinarMetrics } from "@/app/admin/actions";
import { MetricsLive } from "./_MetricsLive";

export const dynamic = "force-dynamic";

export default async function StepMetricas({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initial = await getWebinarMetrics(id);
  return <MetricsLive webinarId={id} initial={initial} />;
}
