"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  UserCog,
  Map,
  BarChart3,
  FileDown,
  Bell,
  CalendarCheck2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/types";

const volunteerNav = [{ href: "/dashboard", label: "Your Students", icon: LayoutDashboard }];

const adminNav = [
  { href: "/admin", label: "Analytics", icon: BarChart3 },
  { href: "/admin/coverage", label: "Coverage", icon: CalendarCheck2 },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/volunteers", label: "Volunteers", icon: UserCog },
  { href: "/admin/roadmap", label: "Roadmap", icon: Map },
  { href: "/admin/reports", label: "Reports & Alerts", icon: FileDown },
];

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const items = user.role === "admin" ? adminNav : volunteerNav;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="h-4 w-4" />
        </div>
        <span className="font-display text-sm font-semibold">EduTrack</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user.role === "admin" && (
        <div className="border-t border-border p-3">
          <Link
            href="/admin/reports"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Bell className="h-3.5 w-3.5" />
            Alerts &amp; notifications
          </Link>
        </div>
      )}
    </aside>
  );
}
