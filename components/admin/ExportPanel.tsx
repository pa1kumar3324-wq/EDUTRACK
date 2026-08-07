"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

async function downloadBlob(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ExportPanel() {
  const [type, setType] = useState<"students" | "progress">("students");
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    setLoadingFormat(format);
    try {
      if (format === "pdf") {
        const res = await fetch(`/api/export?type=${type}&format=json`);
        if (!res.ok) throw new Error("Export failed");
        const { rows } = await res.json();

        const { default: jsPDF } = await import("jspdf");
        await import("jspdf-autotable");
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14);
        doc.text(`EduTrack — ${type === "students" ? "Students" : "Progress"} Report`, 14, 16);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        const body = rows.map((r: Record<string, unknown>) => columns.map((c) => String(r[c] ?? "")));
        // @ts-expect-error — jspdf-autotable augments jsPDF's prototype at import time
        doc.autoTable({ head: [columns], body, startY: 22, styles: { fontSize: 8 } });
        doc.save(`edutrack-${type}.pdf`);
      } else {
        await downloadBlob(`/api/export?type=${type}&format=${format}`, `edutrack-${type}.${format}`);
      }
      toast.success("Export ready", { description: `Downloaded as .${format}` });
    } catch {
      toast.error("Export failed");
    } finally {
      setLoadingFormat(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Export Reports</CardTitle>
        <CardDescription>Download student or progress data for offline reporting.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Select value={type} onValueChange={(v) => setType(v as "students" | "progress")}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="students">Students</SelectItem>
            <SelectItem value="progress">Progress history</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => handleExport("csv")} disabled={loadingFormat !== null}>
          {loadingFormat === "csv" ? <Loader2 className="animate-spin" /> : <FileDown className="h-4 w-4" />}
          CSV
        </Button>
        <Button variant="outline" onClick={() => handleExport("xlsx")} disabled={loadingFormat !== null}>
          {loadingFormat === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          Excel
        </Button>
        <Button variant="outline" onClick={() => handleExport("pdf")} disabled={loadingFormat !== null}>
          {loadingFormat === "pdf" ? <Loader2 className="animate-spin" /> : <FileText className="h-4 w-4" />}
          PDF
        </Button>
      </CardContent>
    </Card>
  );
}
