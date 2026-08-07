"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";
import type { Progress } from "@/lib/types/database";

const STATUS_SCORE: Record<string, number> = { not_understood: 1, needs_help: 2, independent: 3 };
const SCORE_LABEL: Record<number, string> = { 1: "Didn't Understand", 2: "Needs Help", 3: "Independent" };

export function StudentJourneyChart({ history, subject }: { history: Progress[]; subject: "english" | "math" }) {
  const points = history
    .filter((p) => (subject === "english" ? p.english_status : p.math_status))
    .slice()
    .reverse()
    .map((p) => ({
      date: format(new Date(p.created_at), "MMM d"),
      score: STATUS_SCORE[(subject === "english" ? p.english_status : p.math_status) as string] ?? 2,
      topic: subject === "english" ? p.english_topic : p.math_topic,
    }));

  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No {subject} sessions logged yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          domain={[1, 3]}
          ticks={[1, 2, 3]}
          tickFormatter={(v) => SCORE_LABEL[v] ?? ""}
          tick={{ fontSize: 10 }}
          width={90}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, _name, item) => [
            `${SCORE_LABEL[value]} — ${item.payload.topic ?? ""}`,
            subject === "english" ? "English" : "Math",
          ]}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={subject === "english" ? "hsl(var(--primary))" : "hsl(var(--success))"}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
