"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { EffortLeaderboardRow, LearningCircle } from "@/lib/types/database";

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
/** Below this many rated sessions, a student's average is shown with a
 * "Few ratings" badge — same effort average, but not yet backed by much
 * history. Visual only; never changes the sort order (see effortRepository
 * for the actual ranking rules). */
const FEW_RATINGS_THRESHOLD = 3;

async function downloadBlob(url: string, filename: string): Promise<{ downloaded: boolean; message?: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Export failed");
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await res.json().catch(() => ({}));
    if (body.empty) {
      return { downloaded: false, message: body.message ?? "No effort scores have been recorded yet." };
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

export function EffortLeaderboardPanel({
  circles,
  initialRows,
  isAdmin,
}: {
  circles: Pick<LearningCircle, "id" | "name">[];
  initialRows: EffortLeaderboardRow[];
  isAdmin: boolean;
}) {
  const [scope, setScope] = useState<string>("all");
  const [rows, setRows] = useState<EffortLeaderboardRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);

  const selectedCircle = scope === "all" ? null : circles.find((c) => c.id === scope) ?? null;

  async function handleScopeChange(value: string) {
    setScope(value);
    setLoading(true);
    try {
      const params = value === "all" ? "" : `?circleId=${encodeURIComponent(value)}`;
      const res = await fetch(`/api/effort-leaderboard${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to load leaderboard");
      }
      const body = await res.json();
      setRows(body.rows ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    setLoadingFormat(format);
    try {
      const params = new URLSearchParams({ type: "effort-leaderboard", format });
      if (selectedCircle) params.set("circleId", selectedCircle.id);
      const suffix = selectedCircle
        ? `-${selectedCircle.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`
        : "";

      if (format === "pdf") {
        params.set("format", "json");
        const res = await fetch(`/api/export?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Export failed");
        }
        const body = await res.json();
        if (body.empty || (body.rows ?? []).length === 0) {
          toast.info(body.message ?? "No effort scores have been recorded yet.");
          return;
        }
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14);
        doc.text(
          `EduTrack: Effort Leaderboard${selectedCircle ? ` — ${selectedCircle.name}` : " — All Students"}`,
          14,
          16
        );
        const rowsForPdf: Record<string, unknown>[] = body.rows;
        const columns = rowsForPdf.length > 0 ? Object.keys(rowsForPdf[0]!) : [];
        const bodyRows = rowsForPdf.map((r) => columns.map((c) => String(r[c] ?? "")));
        autoTable(doc, {
          head: [columns],
          body: bodyRows,
          startY: 22,
          styles: { fontSize: 8, textColor: [26, 20, 13] },
          headStyles: { fillColor: [23, 87, 61] },
          alternateRowStyles: { fillColor: [247, 242, 233] },
        });
        doc.save(`edutrack-effort-leaderboard${suffix}.pdf`);
      } else {
        const result = await downloadBlob(
          `/api/export?${params.toString()}`,
          `edutrack-effort-leaderboard${suffix}.${format}`
        );
        if (!result.downloaded) {
          toast.info(result.message ?? "No effort scores have been recorded yet.");
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">🏆 Effort Leaderboard</CardTitle>
            <CardDescription>
              Ranked by average effort score — participation, persistence, and willingness to try, not
              correctness.
            </CardDescription>
          </div>
          <Select value={scope} onValueChange={handleScopeChange}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="All Students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {circles.map((circle) => (
                <SelectItem key={circle.id} value={circle.id}>
                  {circle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading leaderboard…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              selectedCircle
                ? "This Learning Circle doesn't have any effort scores yet."
                : "No effort scores have been recorded yet."
            }
            description="Scores are added when a volunteer submits a session's progress update."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Student</TableHead>
                  {!selectedCircle && <TableHead>Learning Circle</TableHead>}
                  <TableHead>Effort Average</TableHead>
                  <TableHead>Sessions Rated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const rank = index + 1;
                  return (
                    <TableRow key={row.student_id}>
                      <TableCell className="font-semibold tabular-nums">
                        {RANK_MEDALS[rank] ?? `#${rank}`}
                      </TableCell>
                      <TableCell className="font-medium">{row.student_name}</TableCell>
                      {!selectedCircle && (
                        <TableCell className="text-sm text-muted-foreground">
                          {row.learning_circle_name ?? "No Learning Circle"}
                        </TableCell>
                      )}
                      <TableCell className="tabular-nums">
                        ⭐ {row.average_effort_score.toFixed(1)} / 10
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums text-muted-foreground">
                          {row.effort_score_count} session{row.effort_score_count === 1 ? "" : "s"}
                        </span>
                        {row.effort_score_count < FEW_RATINGS_THRESHOLD && (
                          <Badge variant="outline" className="ml-2">
                            Few ratings
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {isAdmin && (
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={() => handleExport("csv")} disabled={loadingFormat !== null}>
                  {loadingFormat === "csv" ? <Loader2 className="animate-spin" /> : <FileDown className="h-4 w-4" />}
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")} disabled={loadingFormat !== null}>
                  {loadingFormat === "xlsx" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={loadingFormat !== null}>
                  {loadingFormat === "pdf" ? <Loader2 className="animate-spin" /> : <FileText className="h-4 w-4" />}
                  PDF
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
