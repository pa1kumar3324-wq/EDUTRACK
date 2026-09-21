import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: number;
  tone?: "default" | "warning" | "destructive" | "success";
}

const toneClasses: Record<NonNullable<Stat["tone"]>, string> = {
  default: "text-foreground",
  warning: "text-warning",
  destructive: "text-destructive",
  success: "text-success",
};

/** A row of key numbers. Sits in a header strip, not as separate cards. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-border py-4">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className={cn("font-display text-2xl font-semibold tabular-nums", toneClasses[stat.tone ?? "default"])}>
            {stat.value.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
