"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

async function downloadBlob(url: string, filename: string): Promise<{ downloaded: boolean; message?: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Export failed");
  }
  // The attendance export returns a small JSON payload instead of a file
  // when there's nothing to report for the selected range — detect that
  // instead of downloading an unhelpful empty CSV/XLSX.
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await res.json().catch(() => ({}));
    if (body.empty) {
      return { downloaded: false, message: body.message ?? "No attendance records found for this date range." };
    }
  }
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  return { downloaded: true };
}

/** ISO "YYYY-MM-DD" for a given Date, in local time. */
function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExportPanel() {
  const [type, setType] = useState<"students" | "progress" | "attendance">("students");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);

  function handleTypeChange(value: "students" | "progress" | "attendance") {
    setType(value);
    // Default to month-to-date the first time someone picks Attendance, so
    // they land on a populated register instead of two empty required dates.
    if (value === "attendance" && !from && !to) {
      const now = new Date();
      setFrom(toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(toIsoDate(now));
    }
  }

  const isAttendance = type === "attendance";
  const rangeInvalid = isAttendance && from !== "" && to !== "" && from > to;
  const rangeIncomplete = isAttendance && (from === "" || to === "");
  const exportDisabled = loadingFormat !== null || rangeInvalid || rangeIncomplete;

  function buildQuery(format: string) {
    const params = new URLSearchParams({ type, format });
    if (isAttendance) {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    return params.toString();
  }

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    if (rangeInvalid) {
      toast.error("'From' date must be before 'To' date");
      return;
    }
    if (rangeIncomplete) {
      toast.error("Pick both a 'From' and 'To' date for the attendance register");
      return;
    }
    setLoadingFormat(format);
    try {
      const suffix = isAttendance ? `-${from}_to_${to}` : "";

      if (format === "pdf") {
        const res = await fetch(`/api/export?${buildQuery("json")}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Export failed");
        }
        const body = await res.json();
        const { rows } = body;

        if (isAttendance && (body.empty || rows.length === 0)) {
          toast.info(body.message ?? "No attendance records found for this date range.");
          return;
        }

        const { default: jsPDF } = await import("jspdf");
        await import("jspdf-autotable");
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14);
        const typeLabel = type === "students" ? "Students" : type === "attendance" ? "Attendance" : "Progress";
        doc.text(`EduTrack — ${typeLabel} Report`, 14, 16);
        if (isAttendance) {
          doc.setFontSize(10);
          doc.text(`Range: ${from} to ${to}`, 14, 22);
        }
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        const body2 = rows.map((r: Record<string, unknown>) => columns.map((c) => String(r[c] ?? "")));
        // @ts-expect-error — jspdf-autotable augments jsPDF's prototype at import time
        doc.autoTable({ head: [columns], body: body2, startY: isAttendance ? 27 : 22, styles: { fontSize: 8 } });
        doc.save(`edutrack-${type}${suffix}.pdf`);
      } else {
        const result = await downloadBlob(`/api/export?${buildQuery(format)}`, `edutrack-${type}${suffix}.${format}`);
        if (!result.downloaded) {
          toast.info(result.message ?? "No attendance records found for this date range.");
          return;
        }
      }
      toast.success("Export ready", { description: `Downloaded as .${format}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoadingFormat(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Export Reports</CardTitle>
        <CardDescription>Download student, progress, or attendance data for offline reporting.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Data</Label>
            <Select value={type} onValueChange={(v) => handleTypeChange(v as "students" | "progress" | "attendance")}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="students">Students</SelectItem>
                <SelectItem value="progress">Progress history</SelectItem>
                <SelectItem value="attendance">Attendance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isAttendance && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-from">From date</Label>
                <Input id="export-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-to">To date</Label>
                <Input id="export-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              {(from || to) && (
                <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>
                  Clear range
                </Button>
              )}
            </>
          )}
        </div>

        {isAttendance && (
          <p className="text-xs text-muted-foreground">
            {rangeIncomplete
              ? "Pick a 'From' and 'To' date to build the attendance register."
              : `Exporting the attendance register from ${from} to ${to}, one row per active volunteer with a status column for each day.`}
          </p>
        )}
        {rangeInvalid && <p className="text-xs text-destructive">'From' date must be before 'To' date.</p>}

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => handleExport("csv")} disabled={exportDisabled}>
            {loadingFormat === "csv" ? <Loader2 className="animate-spin" /> : <FileDown className="h-4 w-4" />}
            CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("xlsx")} disabled={exportDisabled}>
            {loadingFormat === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")} disabled={exportDisabled}>
            {loadingFormat === "pdf" ? <Loader2 className="animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
