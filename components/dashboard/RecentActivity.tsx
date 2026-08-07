import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatRelativeDate, STATUS_META } from "@/lib/utils";
import { Activity } from "lucide-react";
import type { RecentActivityItem } from "@/lib/types";

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={Activity} title="No activity yet" description="Progress updates will show up here as they're logged." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm">
                    <Link href={`/students/${item.studentId}`} className="font-medium hover:underline">
                      {item.studentName}
                    </Link>{" "}
                    <span className="text-muted-foreground">— {item.summary}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    by {item.volunteerName} · {formatRelativeDate(item.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { STATUS_META };
