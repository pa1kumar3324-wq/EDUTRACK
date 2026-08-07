"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studentRepository, type StudentFilters } from "@/lib/repositories/studentRepository";
import type { Student } from "@/lib/types/database";

/**
 * Client-side hook for interactive student list filtering (search-as-you-type,
 * dropdown filters) after the initial Server Component render. Re-fetches
 * whenever `filters` changes.
 */
export function useStudents(filters: StudentFilters) {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await studentRepository.list(supabase, filters);
      setStudents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { students, isLoading, error, refetch: fetchStudents };
}
