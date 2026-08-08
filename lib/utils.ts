import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { UnderstandingStatus } from "@/lib/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  developing: "Developing",
  proficient: "Proficient",
  advanced: "Advanced",
};

export const STATUS_META: Record<
  UnderstandingStatus,
  { label: string; emoji: string; className: string }
> = {
  independent: {
    label: "Independent",
    emoji: "🟢",
    className: "bg-success/15 text-success border-success/30",
  },
  needs_help: {
    label: "Needs Help",
    emoji: "🟡",
    className: "bg-warning/15 text-warning border-warning/30",
  },
  not_understood: {
    label: "Didn't Understand",
    emoji: "🔴",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
};
