import {
  LayoutDashboard,
  Users,
  Map,
  BarChart3,
  FileDown,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const volunteerNav: NavItem[] = [
  { href: "/dashboard", label: "Your Students", icon: LayoutDashboard },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Analytics", icon: BarChart3 },
  { href: "/admin/people", label: "People", icon: Users },
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
