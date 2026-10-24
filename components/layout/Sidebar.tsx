"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { cn } from "@/lib/utils";
import { getNavForRole, isNavItemActive } from "@/lib/navigation";
import type { AuthUser } from "@/lib/types";

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const items = getNavForRole(user.role);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/60 md:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <div className="text-sm">
          <Wordmark />
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-accent/10 text-primary before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-accent"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
