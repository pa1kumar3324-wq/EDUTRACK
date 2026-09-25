"use client";

import { cn } from "@/lib/utils";

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * Tactile 1-10 picker for the Weekly Effort Score — the same
 * role="radiogroup" / role="radio" pattern as StatusPicker
 * (components/shared/StatusPicker.tsx), so it's keyboard-accessible the
 * same way: each chip is a real <button>, reachable by Tab, activated by
 * Enter/Space, and the selected one is marked with aria-checked rather than
 * color alone.
 *
 * Deliberately a SINGLE-select 1-10 scale, not a ScaleSelect chip group
 * (components/progress/ScaleSelect.tsx) — ScaleSelect toggles multiple
 * chips in/out of an array, which doesn't fit "exactly one score from 1
 * to 10". A plain `<Select>` dropdown would work but a full number line
 * that's visually obvious at a glance is more legible for a volunteer
 * filling this in quickly, and reads clearly to a competitive kid glancing
 * over their volunteer's shoulder.
 */
export function EffortScorePicker({
  value,
  onChange,
  id = "effort-score",
}: {
  value?: number;
  onChange: (score: number) => void;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        id={id}
        className="grid grid-cols-5 gap-1.5 sm:grid-cols-10"
      >
        {SCORES.map((score) => {
          const active = value === score;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(score)}
              className={cn(
                "flex h-10 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground scale-105 shadow-soft"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {score}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>1 = Very low effort</span>
        <span>10 = Exceptional effort</span>
      </div>
    </div>
  );
}
