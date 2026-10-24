"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavForRole, isNavItemActive } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/Wordmark";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { AuthUser } from "@/lib/types";

export function MobileNav({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const items = getNavForRole(user.role);

  // Close the drawer automatically whenever the route changes.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Browse EduTrack sections
        </SheetDescription>

        <div className="flex h-16 items-center border-b border-border px-5 text-sm">
          <Wordmark />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-colors",
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
      </SheetContent>
    </Sheet>
  );
}
