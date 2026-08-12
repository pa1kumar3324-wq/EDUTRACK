import {
  LayoutDashboard,
  Users,
  UserCog,
  Map,
  BarChart3,
  FileDown,
  CalendarCheck,
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
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/volunteers", label: "Volunteers", icon: UserCog },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/admin/roadmap", label: "Roadmap", icon: Map },
  { href: "/admin/reports", label: "Reports & Alerts", icon: FileDown },
];

export function getNavForRole(role: string): NavItem[] {
  return role === "admin" ? adminNav : volunteerNav;
}
