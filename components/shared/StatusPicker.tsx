"use client";

import { CheckCircle2, CircleHelp, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "independent", label: "Independent", icon: CheckCircle2, tone: "success" as const },
  { value: "needs_help", label: "Needs Help", icon: CircleHelp, tone: "warning" as const },
  { value: "not_understood", label: "Didn't Understand", icon: CircleX, tone: "destructive" as const },
];

const TONE_CLASSES: Record<"success" | "warning" | "destructive", string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** Tactile replacement for a plain <Select> when logging how a lesson landed —
 *  the choice a volunteer makes here drives the "needs revision" flag and the
 *  suggested-next-lesson engine, so it deserves to feel deliberate, not buried
 *  in a dropdown. */
export function StatusPicker({
  value,
  onChange,
  label,
  id,
}: {
  value?: string;
  onChange: (status: string) => void;
  label?: string;
  id?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} id={id} className="grid grid-cols-3 gap-2">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? TONE_CLASSES[opt.tone] : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4", active && "scale-110")} />
            <span className="leading-tight">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
