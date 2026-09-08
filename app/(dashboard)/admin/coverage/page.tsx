import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analyticsRepository } from "@/lib/repositories/analyticsRepository";
import { PageHeader } from "@/components/shared/PageHeader";
import { CoverageBoard } from "@/components/admin/CoverageBoard";

export default async function AdminCoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ weekend?: string }>;
}) {
  await requireAdmin();
  const { weekend } = await searchParams;
  const supabase = await createClient();
  const coverage = await analyticsRepository.weekendCoverage(supabase, weekend);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Weekend Coverage"
        description="Which students got a progress update this weekend, so a missed session never slips through unnoticed."
      />
      <CoverageBoard coverage={coverage} />
    </div>
  );
}
