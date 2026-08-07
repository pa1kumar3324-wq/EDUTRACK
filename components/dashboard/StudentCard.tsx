"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, NotebookPen, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, formatRelativeDate, LEVEL_LABELS } from "@/lib/utils";
import type { StudentWithProgress } from "@/lib/types";

const STATUS_BADGE: Record<StudentWithProgress["status"], { label: string; variant: "success" | "warning" | "destructive" }> = {
  "on-track": { label: "On Track", variant: "success" },
  "needs-revision": { label: "Needs Revision", variant: "warning" },
  stale: { label: "No Recent Update", variant: "destructive" },
};

export function StudentCard({ data, index = 0 }: { data: StudentWithProgress; index?: number }) {
  const { student, latestProgress, assignedVolunteers, status } = data;
  const badge = STATUS_BADGE[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Card className="group h-full">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border border-border">
                <AvatarImage src={student.photo_url ?? undefined} alt={student.name} />
                <AvatarFallback>{initials(student.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-display text-sm font-semibold leading-tight">{student.name}</p>
                <p className="text-xs text-muted-foreground">Grade {student.grade}</p>
              </div>
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-secondary/60 px-2.5 py-2">
              <p className="text-muted-foreground">English</p>
              <p className="font-medium">{LEVEL_LABELS[student.english_level]}</p>
            </div>
            <div className="rounded-lg bg-secondary/60 px-2.5 py-2">
              <p className="text-muted-foreground">Math</p>
              <p className="font-medium">{LEVEL_LABELS[student.math_level]}</p>
            </div>
          </div>

          {assignedVolunteers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {assignedVolunteers.slice(0, 4).map((v) => (
                <Avatar key={v.id} className="h-6 w-6 border-2 border-card" title={v.name}>
                  <AvatarImage src={v.avatar_url ?? undefined} alt={v.name} />
                  <AvatarFallback className="text-[10px]">{initials(v.name)}</AvatarFallback>
                </Avatar>
              ))}
              {assignedVolunteers.length > 4 && (
                <span className="pl-3 text-xs text-muted-foreground">+{assignedVolunteers.length - 4}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {latestProgress ? (
              <span>
                Last taught by {latestProgress.volunteer_name} · {formatRelativeDate(latestProgress.created_at)}
              </span>
            ) : (
              <span>No sessions logged yet</span>
            )}
          </div>

          <div className="mt-auto flex gap-2 pt-1">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href={`/students/${student.id}`}>
                View Progress <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" className="flex-1">
              <Link href={`/students/${student.id}/update`}>
                <NotebookPen className="h-3.5 w-3.5" /> Update
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
