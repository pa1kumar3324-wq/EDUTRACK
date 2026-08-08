"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { CalendarCheck, Check, X, Clock, ShieldOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { initials, cn } from "@/lib/utils";
import type { Volunteer, AttendanceStatus, Attendance } from "@/lib/types/database";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: typeof Check; className: string }[] = [
  { value: "present", label: "Present", icon: Check, className: "data-[active=true]:bg-success/15 data-[active=true]:text-success data-[active=true]:border-success/40" },
  { value: "late", label: "Late", icon: Clock, className: "data-[active=true]:bg-warning/15 data-[active=true]:text-warning data-[active=true]:border-warning/40" },
  { value: "absent", label: "Absent", icon: X, className: "data-[active=true]:bg-destructive/15 data-[active=true]:text-destructive data-[active=true]:border-destructive/40" },
  { value: "excused", label: "Excused", icon: ShieldOff, className: "data-[active=true]:bg-secondary data-[active=true]:text-foreground data-[active=true]:border-border" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceMarker({ volunteers }: { volunteers: Volunteer[] }) {
  const [date, setDate] = useState(todayISO());
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadDate = useCallback(async (d: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/attendance?date=${d}`);
      if (res.ok) {
        const { records: rows } = await res.json();
        const map: Record<string, AttendanceStatus> = {};
        for (const r of rows as (Attendance & { volunteer_id: string })[]) {
          map[r.volunteer_id] = r.status;
        }
        setRecords(map);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDate(date);
  }, [date, loadDate]);

  async function markOne(volunteerId: string, status: AttendanceStatus) {
    setSavingId(volunteerId);
    const prev = records[volunteerId];
    setRecords((r) => ({ ...r, [volunteerId]: status }));
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volunteer_id: volunteerId, session_date: date, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRecords((r) => ({ ...r, [volunteerId]: prev as AttendanceStatus }));
      toast.error("Failed to save attendance");
    } finally {
      setSavingId(null);
    }
  }

  async function markAllPresent() {
    setBulkSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volunteer_ids: volunteers.map((v) => v.id),
          session_date: date,
          status: "present",
        }),
      });
      if (!res.ok) throw new Error();
      const map: Record<string, AttendanceStatus> = {};
      for (const v of volunteers) map[v.id] = "present";
      setRecords(map);
      toast.success("Marked everyone present");
    } catch {
      toast.error("Failed to bulk mark attendance");
    } finally {
      setBulkSaving(false);
    }
  }

  const markedCount = Object.keys(records).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-date">Session date</Label>
          <Input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {markedCount} / {volunteers.length} marked
          </p>
          <Button variant="outline" onClick={markAllPresent} disabled={bulkSaving || volunteers.length === 0}>
            {bulkSaving ? <Loader2 className="animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Mark all present
          </Button>
        </div>
      </div>

      {volunteers.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No volunteers yet" description="Invite volunteers before taking attendance." />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {volunteers.map((v) => {
              const current = records[v.id];
              return (
                <div key={v.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={v.avatar_url ?? undefined} alt={v.name} />
                      <AvatarFallback className="text-xs">{initials(v.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        data-active={current === opt.value}
                        disabled={savingId === v.id || isLoading}
                        onClick={() => markOne(v.id, opt.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50",
                          opt.className
                        )}
                      >
                        <opt.icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
