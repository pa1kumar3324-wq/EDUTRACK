"use client";

import { cn } from "@/lib/utils";

export interface ScaleOption {
  value: string;
  label: string;
}

/**
 * A compact row of tappable chips for a single structured observation
 * question — the building block behind most of the rich progress-logging
 * form (§34). Deliberately terse: short labels, no icons, wraps onto a
 * second line rather than growing the row's height, so a form with a dozen
 * of these stays scannable instead of turning into a giant questionnaire.
 */
export function ScaleSelect({
  options,
  value,
  onChange,
  label,
  id,
}: {
  options: ScaleOption[];
  value?: string;
  onChange: (value: string) => void;
  label: string;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
