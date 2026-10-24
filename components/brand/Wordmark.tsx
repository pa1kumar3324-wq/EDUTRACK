import { cn } from "@/lib/utils";
import { CREATOR_NAME, PRODUCT_NAME, getEmporumUrl } from "@/lib/brand";
import { TrackMark } from "@/components/brand/TrackMark";

/**
 * Subtle EduTrack name followed by a small "by Emporum" credit. "Emporum" is a real link to the
 * Emporum website and opens in a new tab.
 */
export function Wordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <TrackMark className={markClassName} />
      <span className="inline-flex items-baseline gap-1.5">
        <span className="font-medium tracking-wide text-foreground/90">{PRODUCT_NAME}</span>
        <span className="text-[0.7em] font-normal text-muted-foreground">
          by{" "}
          <a
            href={getEmporumUrl()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${CREATOR_NAME} (opens in a new tab)`}
            className="rounded-sm font-semibold text-muted-foreground underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-primary hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CREATOR_NAME}
          </a>
        </span>
      </span>
    </span>
  );
}
