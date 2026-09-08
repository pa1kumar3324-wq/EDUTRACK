"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const LEVELS = ["beginner", "developing", "proficient", "advanced"] as const;
type Level = (typeof LEVELS)[number];

const LABELS: Record<Level, string> = {
  beginner: "Beginner",
  developing: "Developing",
  proficient: "Proficient",
  advanced: "Advanced",
};

/** Segmented-control replacement for a plain <Select> when choosing a discrete,
 *  ordered level — gives the choice weight with a sliding highlight instead of
 *  hiding the options behind a click. */
export function LevelPicker({
  value,
  onChange,
  label,
  id,
}: {
  value: string;
  onChange: (level: Level) => void;
  label?: string;
  id?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} id={id} className="grid grid-cols-2 gap-1.5 rounded-xl bg-secondary/70 p-1 sm:grid-cols-4">
      {LEVELS.map((level) => {
        const active = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(level)}
            className={cn(
              "relative rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`level-picker-highlight-${id ?? "default"}`}
                className="absolute inset-0 rounded-lg bg-primary shadow-soft"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative">{LABELS[level]}</span>
          </button>
        );
      })}
    </div>
  );
}
