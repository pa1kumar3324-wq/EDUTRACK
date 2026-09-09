"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type TabNavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
};

/**
 * Compact, route-based tab bar for consolidated admin workspaces (e.g.
 * People, Reports & Coverage). Each tab is a real route so links stay
 * shareable/deep-linkable, but it's styled to read as one workspace rather
 * than separate pages. Scrolls horizontally on narrow screens instead of
 * squeezing labels or wrapping.
 */
export function TabNav({ items }: { items: TabNavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="scrollbar-thin -mx-1 mb-6 overflow-x-auto px-1">
      <div className="inline-flex min-w-full items-center gap-1 rounded-lg bg-secondary p-1 sm:min-w-0">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-all",
                active
                  ? "bg-background text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.icon && <item.icon className="h-3.5 w-3.5" />}
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
