"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  WeeklyProgressPoint,
  LevelDistributionPoint,
  WeakTopicPoint,
  VolunteerActivityPoint,
} from "@/lib/types";

const AXIS_STYLE = { fontSize: 12 };
const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  fontSize: 12,
};
const PIE_COLORS = ["hsl(var(--destructive))", "hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--success))"];

export function WeeklyProgressChart({ data }: { data: WeeklyProgressPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Weekly Progress Updates</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="week" tick={AXIS_STYLE} />
            <YAxis allowDecimals={false} tick={AXIS_STYLE} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="updates" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function LevelDistributionChart({ title, data }: { title: string; data: LevelDistributionPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="level" innerRadius={50} outerRadius={80} paddingAngle={3}>
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, textTransform: "capitalize" }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function WeakTopicsChart({ data }: { data: WeakTopicPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Most Common Weak Topics</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS_STYLE} />
            <YAxis type="category" dataKey="topic" width={110} tick={AXIS_STYLE} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function VolunteerActivityChart({ data }: { data: VolunteerActivityPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Volunteer Activity</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" tick={AXIS_STYLE} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={AXIS_STYLE} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="updates" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="studentsAssigned" fill="hsl(var(--secondary-foreground))" radius={[6, 6, 0, 0]} fillOpacity={0.3} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
