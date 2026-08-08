"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarCheck } from "lucide-react";
import type { AttendanceSummary } from "@/lib/repositories/attendanceRepository";

const SLICES: { key: keyof Pick<AttendanceSummary, "present" | "late" | "absent" | "excused">; label: string; color: string }[] = [
  { key: "present", label: "Present", color: "hsl(var(--success))" },
  { key: "late", label: "Late", color: "hsl(var(--warning))" },
  { key: "absent", label: "Absent", color: "hsl(var(--destructive))" },
  { key: "excused", label: "Excused", color: "hsl(var(--muted-foreground))" },
];

/** Shows a volunteer's own present/late/absent/excused breakdown as a donut chart. */
export function AttendancePieChart({ summary }: { summary: AttendanceSummary }) {
  const data = SLICES.map((s) => ({ name: s.label, value: summary[s.key], color: s.color })).filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarCheck className="h-4 w-4 text-primary" /> Your Attendance
        </CardTitle>
        <CardDescription>
          {summary.total === 0
            ? "No sessions logged yet."
            : `${summary.attendanceRate}% attendance rate across ${summary.total} session${summary.total === 1 ? "" : "s"}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-56">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Once a leader marks your attendance, it'll show up here.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
