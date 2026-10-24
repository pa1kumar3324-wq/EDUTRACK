import { cn } from "@/lib/utils";

/**
 * EduTrack's own mark, drawn in Emporum's visual language (stacked rounded bars, ivory + gold).
 * Emporum's bars are equal length; these step upward and the longest one reaches gold, reading
 * as "progress" so the two marks rhyme without being the same logo.
 */
export function TrackMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 20" aria-hidden="true" focusable="false" className={cn("h-5 w-[26px] shrink-0", className)}>
      <rect x="0" y="0" width="13" height="4" rx="2" fill="currentColor" />
      <rect x="0" y="8" width="20" height="4" rx="2" fill="currentColor" />
      <rect x="0" y="16" width="26" height="4" rx="2" fill="hsl(var(--accent))" />
    </svg>
  );
}
