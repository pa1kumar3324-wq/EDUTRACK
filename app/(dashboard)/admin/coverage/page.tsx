import { redirect } from "next/navigation";

export default async function AdminCoverageRedirect({
  searchParams,
}: {
  searchParams: Promise<{ weekend?: string }>;
}) {
  const { weekend } = await searchParams;
  redirect(weekend ? `/admin/reports-coverage/coverage?weekend=${weekend}` : "/admin/reports-coverage/coverage");
}
