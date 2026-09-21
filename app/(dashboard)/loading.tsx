import { Skeleton } from "@/components/ui/skeleton";
import { StatStripSkeleton } from "@/components/shared/LoadingSkeleton";

/** Shown while a dashboard route segment's server data is loading (Sidebar/Topbar
 *  are already painted since they live in the parent layout, so only the content
 *  area flashes this — no full-page white flash on navigation). */
export default function DashboardSegmentLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-6 w-48" />
      <StatStripSkeleton />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
