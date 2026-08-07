import { STATUS_META } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { UnderstandingStatus } from "@/lib/types/database";

/** Renders the 🟢🟡🔴 understanding-status pill used throughout the app. */
export function StatusBadge({ status, className }: { status: UnderstandingStatus | null | undefined; className?: string }) {
  if (!status) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground", className)}>
        Not logged
      </span>
    );
  }
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.className, className)}>
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
