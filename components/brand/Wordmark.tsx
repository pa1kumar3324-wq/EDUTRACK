import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/brand";
import { TrackMark } from "@/components/brand/TrackMark";

/** Mark + spaced uppercase name, after Emporum's wordmark. EduTrack's name always leads. */
export function Wordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3 font-extrabold uppercase tracking-[0.2em]", className)}>
      <TrackMark className={markClassName} />
      <span>{PRODUCT_NAME}</span>
    </span>
  );
}
