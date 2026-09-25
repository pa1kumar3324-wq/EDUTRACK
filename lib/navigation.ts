import {
  LayoutDashboard,
  Users,
  Map,
  BarChart3,
  FileDown,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Shared by both volunteerNav and adminNav — the Effort Leaderboard reads
// the same progress data every authenticated user can already see
// (progress_select_all), so it isn't an admin-only surface like the rest
// of adminNav. Only the leaderboard's export is admin-gated (see
// components/shared/EffortLeaderboardPanel.tsx).
const EFFORT_LEADERBOARD_NAV_ITEM: NavItem = {
  href: "/effort-leaderboard",
  label: "Effort Leaderboard",
  icon: Trophy,
};

export const volunteerNav: NavItem[] = [
  { href: "/dashboard", label: "Your Students", icon: LayoutDashboard },
  EFFORT_LEADERBOARD_NAV_ITEM,
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Analytics", icon: BarChart3 },
  { href: "/admin/people", label: "People", icon: Users },
  // Debrief verification for Learning Circles this admin leads. Shown to
  // every admin: an org with no circles sees an empty-state that explains
  // the feature rather than a broken-looking page.
  { href: "/admin/verification", label: "Verification", icon: ShieldCheck },
  EFFORT_LEADERBOARD_NAV_ITEM,
  { href: "/admin/reports-coverage", label: "Reports & Coverage", icon: FileDown },
  { href: "/admin/roadmap", label: "Roadmap", icon: Map },
];

export function getNavForRole(role: string): NavItem[] {
  return role === "admin" ? adminNav : volunteerNav;
}

/**
 * Whether a top-level nav item should render as active for the current
 * pathname — exact match for leaf destinations (e.g. "/admin/roadmap"), or
 * "is inside this workspace" for consolidated destinations with their own
 * sub-routes (e.g. "/admin/people/volunteers" under "/admin/people").
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin") return false;
  return pathname.startsWith(`${href}/`);
}
