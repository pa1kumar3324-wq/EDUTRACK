import { EmporumAttribution } from "@/components/brand/EmporumAttribution";
import { cn } from "@/lib/utils";

/** Application footer: a hairline rule and one quiet line of credit. */
export function AppFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-border px-4 py-4 md:px-6", className)}>
      <EmporumAttribution variant="footer" />
    </footer>
  );
}
