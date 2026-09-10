import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { UnderstandingStatus } from "@/lib/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Everyday display identity for a volunteer: preferred_name when set,
 * falling back to the official name. Use this everywhere a volunteer's name
 * is shown in normal UI (greetings, lists, dashboards, cards, Tsareena).
 * Formal contexts (attendance exports, admin records) should keep reading
 * `name` directly instead of calling this.
 */
export function displayName(person: { name: string; preferred_name?: string | null }): string {
  const preferred = person.preferred_name?.trim();
  return preferred ? preferred : person.name;
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

/** True if dateOfBirth ("YYYY-MM-DD") falls within the next `windowDays` days, counting today as day 0. Compares month/day only — never derives age. */
export function isBirthdayUpcoming(dateOfBirth: string, windowDays = 7, referenceDate: Date = new Date()): boolean {
  const [, monthStr, dayStr] = dateOfBirth.split("-");
  const birthMonth = Number(monthStr);
  const birthDay = Number(dayStr);
  const today = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    if (d.getUTCMonth() + 1 === birthMonth && d.getUTCDate() === birthDay) return true;
  }
  return false;
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
