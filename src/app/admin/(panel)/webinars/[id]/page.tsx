import { redirect } from "next/navigation";

export default async function WebinarIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/webinars/${id}/inicio`);
}
