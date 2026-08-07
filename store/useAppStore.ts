import { create } from "zustand";
import type { AuthUser } from "@/lib/types";

interface StudentFiltersState {
  search: string;
  grade: number | null;
  englishLevel: string | null;
  mathLevel: string | null;
  volunteerId: string | null;
  status: string | null;
}

interface AppState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;

  filters: StudentFiltersState;
  setFilter: <K extends keyof StudentFiltersState>(key: K, value: StudentFiltersState[K]) => void;
  resetFilters: () => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

const defaultFilters: StudentFiltersState = {
  search: "",
  grade: null,
  englishLevel: null,
  mathLevel: null,
  volunteerId: null,
  status: null,
};

/**
 * Small global store for client-side-only UI state: current user (hydrated
 * once from the server layout), student list filters, and the command
 * palette. Server data itself (students, progress, analytics) is fetched via
 * Server Components / route handlers, not duplicated here.
 */
export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  filters: defaultFilters,
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));
