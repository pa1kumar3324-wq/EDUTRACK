import { EmporumAttribution } from "@/components/brand/EmporumAttribution";
import { Wordmark } from "@/components/brand/Wordmark";

/**
 * Shared frame for the signed-out screens (sign in, forgot / reset / set password).
 * Emporum's hero language, dialled down: obsidian ground, film grain, a faint halo behind the card.
 * It wraps the existing forms unchanged and adds only chrome and the creator credit.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="halo pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(560px,140vw)] -translate-x-1/2 -translate-y-1/2"
      />
      <div className="relative z-10 w-full max-w-sm animate-rise">
        <h1 className="mb-8 flex justify-center text-sm text-foreground">
          <Wordmark />
        </h1>
        {children}
      </div>
      <EmporumAttribution variant="auth" className="relative z-10 mt-10" />
    </div>
  );
}
