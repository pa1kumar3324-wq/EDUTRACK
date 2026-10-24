import { cn } from "@/lib/utils";
import { CREATOR_NAME, PRODUCT_NAME, getEmporumUrl } from "@/lib/brand";

type Variant = "footer" | "auth";

/**
 * Quiet credit to EduTrack's creator. Never promotional: small, muted, and the product name stays
 * dominant everywhere it appears. The name always links to the Emporum site.
 */
export function EmporumAttribution({ variant = "footer", className }: { variant?: Variant; className?: string }) {
  const url = getEmporumUrl();

  const name = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${CREATOR_NAME} (opens in a new tab)`}
      className="rounded-sm font-semibold text-foreground underline decoration-muted-foreground/60 decoration-1 underline-offset-4 transition-colors hover:text-primary hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {CREATOR_NAME}
    </a>
  );

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {variant === "footer" ? (
        <>
          {PRODUCT_NAME} <span aria-hidden="true">·</span> Built by {name}
        </>
      ) : (
        <>An education product by {name}</>
      )}
    </p>
  );
}
