import { LEVEL_LABELS, cn } from "@/lib/utils";

const LEVEL_DOTS: Record<string, number> = { beginner: 1, developing: 2, proficient: 3, advanced: 4 };

/** Compact "Beginner ●○○○" style badge for English/Math levels. */
export function LevelBadge({ level, subject, className }: { level: string; subject: "English" | "Math"; className?: string }) {
  const filled = LEVEL_DOTS[level] ?? 1;
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      <span className="font-medium text-foreground">{subject}</span>
      <span className="flex gap-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < filled ? "bg-primary" : "bg-muted-foreground/20")} />
        ))}
      </span>
      <span className="text-muted-foreground">{LEVEL_LABELS[level] ?? level}</span>
    </div>
  );
}
