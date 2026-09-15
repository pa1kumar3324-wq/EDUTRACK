"use client";

import { useSyncExternalStore } from "react";

function subscribe(query: string, onChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** SSR-safe media query hook. Returns false on the server/first client render, then updates after mount. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Matches Tailwind's `md` breakpoint (768px) — below this, use Tsareena's mobile presentation. */
export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)");
}
