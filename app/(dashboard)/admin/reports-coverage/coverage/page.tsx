import { createClient } from "@/lib/supabase/server";
import { analyticsRepository } from "@/lib/repositories/analyticsRepository";
import { CoverageBoard } from "@/components/admin/CoverageBoard";

export default async function AdminReportsCoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ weekend?: string }>;
}) {
  const { weekend } = await searchParams;
  const supabase = await createClient();
  const coverage = await analyticsRepository.weekendCoverage(supabase, weekend);

  return <CoverageBoard coverage={coverage} />;
}
