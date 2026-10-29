import { notFound } from "next/navigation";
import { getLiveDashboard } from "../../../ao-vivo/actions";
import { LiveDashboard } from "../../../ao-vivo/_LiveDashboard";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initial = await getLiveDashboard("test", id);
  if (!initial) notFound();
  return <LiveDashboard key={id} initial={initial} mode="comparison" />;
}
