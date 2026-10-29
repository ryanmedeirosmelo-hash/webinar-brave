import { notFound } from "next/navigation";
import { getLiveDashboard } from "../actions";
import { LiveDashboard } from "../_LiveDashboard";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initial = await getLiveDashboard("webinar", id);
  if (!initial) notFound();
  return <LiveDashboard key={id} initial={initial} mode="live" />;
}
