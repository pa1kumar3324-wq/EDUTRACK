import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DebriefVerificationStatus } from "@/lib/types/database";

/**
 * Pill showing where a class debrief sits in the verification lifecycle.
 *
 * Deliberately renders NOTHING for a verified debrief that never needed
 * verification (i.e. no Learning Circle was involved). Most orgs won't use
 * circles at all, and stamping a green "Verified" tick on every historical
 * entry would add noise to a timeline that previously had none — the badge
 * should only appear where verification is actually part of the workflow.
 * Pass `inCircle` to say whether this debrief belonged to a circle.
 */
export function VerificationBadge({
  status,
  inCircle,
  className,
}: {
  status: DebriefVerificationStatus | null | undefined;
  inCircle?: boolean;
  className?: string;
}) {
  if (!status) return null;
  if (status === "verified" && !inCircle) return null;

  const meta = {
    pending: {
      label: "Awaiting verification",
      icon: Clock,
      className: "border-warning/30 bg-warning/15 text-warning",
    },
    verified: {
      label: "Verified",
      icon: CheckCircle2,
      className: "border-success/30 bg-success/15 text-success",
    },
    rejected: {
      label: "Sent back",
      icon: XCircle,
      className: "border-destructive/30 bg-destructive/15 text-destructive",
    },
  }[status];

  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        meta.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
