import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, initials, formatRelativeDate } from "@/lib/utils";
import type { CoverageEntry } from "@/lib/types";

function CoverageCard({ entry }: { entry: CoverageEntry }) {
  const { student, updated, volunteerName, updatedAt, assignedVolunteers } = entry;

  return (
    <Link href={`/students/${student.id}`} className="block">
      <Card
        className={cn(
          "h-full border-l-4 transition-colors hover:bg-secondary/40",
          updated ? "border-l-success" : "border-l-destructive"
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <Avatar className="h-10 w-10 shrink-0 border border-border">
            <AvatarImage src={student.photo_url ?? undefined} alt={student.name} />
            <AvatarFallback>{initials(student.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{student.name}</p>
            <p className="text-xs text-muted-foreground">Grade {student.grade}</p>
            {updated ? (
              <p className="mt-1 truncate text-xs text-success">
                {volunteerName} · {updatedAt ? formatRelativeDate(updatedAt) : ""}
              </p>
            ) : (
              <p className="mt-1 truncate text-xs text-destructive">
                {assignedVolunteers.length > 0 ? `Assigned to ${assignedVolunteers.join(", ")}` : "Unassigned"}
              </p>
            )}
          </div>
          <Badge variant={updated ? "success" : "destructive"} className="shrink-0">
            {updated ? "Updated" : "Missing"}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Two color-coded grids answering "who was updated this weekend, and who wasn't". */
export function CoverageBoard({ entries }: { entries: CoverageEntry[] }) {
  const missing = entries.filter((e) => !e.updated);
  const updated = entries.filter((e) => e.updated);

  return (
    <div className="flex flex-col gap-6">
      {missing.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-destructive">
            <XCircle className="h-4 w-4" /> Missing ({missing.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missing.map((entry) => (
              <CoverageCard key={entry.student.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {updated.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Updated ({updated.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {updated.map((entry) => (
              <CoverageCard key={entry.student.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
