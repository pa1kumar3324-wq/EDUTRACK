"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studentRepository, type StudentFilters } from "@/lib/repositories/studentRepository";
import type { Student } from "@/lib/types/database";

/**
 * Client-side hook for interactive student list filtering (search-as-you-type,
 * dropdown filters) after the initial Server Component render. Re-fetches
 * whenever `filters` changes.
 *
 * STALE-RESPONSE GUARD: filters can change faster than a request resolves
 * (e.g. typing quickly in the search box fires a new request per keystroke).
 * Network responses are not guaranteed to arrive in the order they were
 * sent — an earlier, slower request can resolve AFTER a newer, faster one,
 * and without a guard its stale result would silently overwrite the fresher
 * data already on screen. `requestIdRef` tags every fetch with an
 * incrementing id; a response is only applied to state if it's still the
 * most recently issued request by the time it resolves. Similar in spirit
 * to a boolean `cancelled` flag used by other fetch effects in this
 * codebase, but as a monotonically increasing id (rather than a single
 * boolean) so it works correctly across an arbitrary number of in-flight
 * requests, not just the two-requests-at-once case.
 */
export function useStudents(filters: StudentFilters) {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const filtersKey = JSON.stringify(filters);

  const fetchStudents = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await studentRepository.list(supabase, filters);
      // A newer request has since been issued (filters changed again while
      // this one was in flight) — drop this result rather than let it
      // clobber whatever the newer, still-pending or already-resolved
      // request produces.
      if (requestId !== requestIdRef.current) return;
      setStudents(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    // Data-fetching effect: re-fetch whenever the memoized callback identity
    // changes (i.e. whenever `filters` changes). This is the documented
    // "fetching data" use case for Effects, not a synchronous setState loop
    // (react-hooks/set-state-in-effect is disabled project-wide — see
    // eslint.config.mjs).
    fetchStudents();
  }, [fetchStudents]);

  return { students, isLoading, error, refetch: fetchStudents };
}
