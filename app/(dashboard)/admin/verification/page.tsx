import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { learningCircleRepository } from "@/lib/repositories/learningCircleRepository";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DebriefVerificationQueue } from "@/components/admin/DebriefVerificationQueue";

/**
 * The lead admin's debrief verification queue.
 *
 * Defaults to "My circles" — the debriefs this admin can actually act on.
 * "All circles" is oversight only: the verify/reject buttons are hidden
 * there, because guard_debrief_verification() lets only a circle's own lead
 * change a debrief's status and offering a button that will 403 is worse
 * than not offering it.
 */
export default async function AdminVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await requireAdmin();
  const { scope } = await searchParams;
  const supabase = await createClient();

  const showAll = scope === "all";

  const [debriefs, circles] = await Promise.all([
    learningCircleRepository.listPendingDebriefs(supabase, showAll ? null : user.id),
    learningCircleRepository.list(supabase),
  ]);

  const ledByMe = circles.filter((c) => c.lead_admin_id === user.id);

  return (
    <div className="flex flex-col gap-0">
      <PageHeader
        title="Verification"
        description="Class debriefs from your Learning Circles. A debrief joins the student's record only once you verify it."
      />

      {/* Not TabNav: these two views differ by query string, and TabNav
          decides "active" from the pathname alone, so both tabs would read
          as selected. Server-rendered links keep the scope shareable. */}
      <div className="mb-6 inline-flex items-center gap-1 self-start rounded-lg bg-secondary p-1">
        {[
          { href: "/admin/verification", label: `My circles (${ledByMe.length})`, active: !showAll },
          { href: "/admin/verification?scope=all", label: "All circles", active: showAll },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-all",
              tab.active
                ? "bg-background text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {circles.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No Learning Circles yet"
          description="Verification only applies to volunteers in a Learning Circle. Create one to start reviewing debriefs before they're recorded."
          action={
            <Button asChild size="sm">
              <Link href="/admin/people/circles">Create a Learning Circle</Link>
            </Button>
          }
        />
      ) : (
        <DebriefVerificationQueue initialDebriefs={debriefs} canAct={!showAll} />
      )}
    </div>
  );
}
