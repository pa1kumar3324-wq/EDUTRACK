"use client";

import { useEffect, useState } from "react";

/** SSR-safe media query hook. Returns false on the server/first client render, then updates after mount. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

/** Matches Tailwind's `md` breakpoint (768px) — below this, use Tsareena's mobile presentation. */
export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)");
}
