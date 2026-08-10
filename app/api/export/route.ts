import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * GET /api/export?format=csv|xlsx|json&type=students|progress|attendance — admin only.
 * Streams back the requested file as a download (json is used internally to
 * build client-side PDFs — see the Reports page's ExportPanel).
 *
 * Attendance is exported as a register: one row per volunteer, with one
 * column per date that ACTUALLY has at least one attendance record in
 * [from, to] (this app only takes attendance on weekends, so most calendar
 * days have none — those days must not appear as columns at all). A missing
 * cell means no session/no entry for that volunteer that day, not "absent".
 * If nothing was recorded in the range at all, all formats return a small
 * JSON `{ empty: true, message }` payload instead of a file.
 */
export async function GET(request: Request) {
  await requireAdmin();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const type = searchParams.get("type") ?? "students";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  if (type === "attendance" && (!from || !to)) {
    return NextResponse.json(
      { error: "Both 'from' and 'to' dates are required to export the attendance register." },
      { status: 400 }
    );
  }

  let rows: Record<string, unknown>[] = [];
  let filename = `edutrack-${type}`;
  if (type === "attendance") {
    filename += `-${from}_to_${to}`;
  }

  if (type === "students") {
    const { data, error } = await supabase
      .from("students")
      .select("name, grade, english_level, math_level, is_active, created_at")
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows = (data ?? []).map((s) => ({
      Name: s.name,
      Grade: s.grade,
      "English Level": s.english_level,
      "Math Level": s.math_level,
      Active: s.is_active ? "Yes" : "No",
      "Added On": new Date(s.created_at).toLocaleDateString(),
    }));
  } else if (type === "attendance") {
    // `from`/`to` are guaranteed defined here (checked above).
    //
    // This app only takes attendance on weekends (occasionally a weekday by
    // mistake), so a report must NOT create a column for every calendar day
    // in the range — that would produce a mostly-blank register and would
    // wrongly imply "no record" means "absent". The only source of truth is
    // which dates actually have at least one row in `attendance`.
    const { data: records, error: recordsError } = await supabase
      .from("attendance")
      .select("volunteer_id, session_date, status")
      .gte("session_date", from!)
      .lte("session_date", to!);
    if (recordsError) return NextResponse.json({ error: recordsError.message }, { status: 500 });

    // Unique session dates that actually have an attendance entry, sorted chronologically.
    const dates = Array.from(new Set((records ?? []).map((r) => r.session_date))).sort();

    if (dates.length === 0) {
      // No attendance was ever entered in this range — return a clean empty
      // result rather than a huge calendar of blank columns. The client is
      // responsible for surfacing "No attendance records found for this
      // date range." instead of downloading an empty file.
      rows = [];
    } else {
      const { data: volunteers, error: volunteersError } = await supabase
        .from("volunteers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (volunteersError) return NextResponse.json({ error: volunteersError.message }, { status: 500 });

      // volunteer_id -> session_date -> status
      const statusByVolunteer = new Map<string, Map<string, string>>();
      for (const record of records ?? []) {
        const byDate = statusByVolunteer.get(record.volunteer_id) ?? new Map<string, string>();
        byDate.set(record.session_date, record.status);
        statusByVolunteer.set(record.volunteer_id, byDate);
      }

      rows = (volunteers ?? []).map((v) => {
        const byDate = statusByVolunteer.get(v.id);
        const row: Record<string, unknown> = { Name: v.name };
        for (const date of dates) {
          // Missing entry means no session/no attendance record for that
          // volunteer on that date — NOT "absent". Leave the cell blank.
          row[date] = byDate?.get(date) ?? "";
        }
        return row;
      });
    }
  } else {
    const { data, error } = await supabase
      .from("progress")
      .select("created_at, english_topic, english_status, math_topic, math_status, homework, students(name), volunteers(name)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows = (data ?? []).map((row) => ({
      Date: new Date(row.created_at).toLocaleDateString(),
      Student: row.students?.name ?? "",
      Volunteer: row.volunteers?.name ?? "",
      "English Topic": row.english_topic ?? "",
      "English Status": row.english_status ?? "",
      "Math Topic": row.math_topic ?? "",
      "Math Status": row.math_status ?? "",
      Homework: row.homework ?? "",
    }));
  }

  if (type === "attendance" && rows.length === 0) {
    // Empty range: no attendance was ever entered here. Respond with a
    // small, explicit JSON payload (regardless of requested format) so the
    // client can show "No attendance records found for this date range."
    // instead of downloading a blank file.
    return NextResponse.json({
      rows: [],
      empty: true,
      message: "No attendance records found for this date range.",
    });
  }

  if (format === "csv") {
    const csv = Papa.unparse(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, type === "students" ? "Students" : type === "attendance" ? "Attendance" : "Progress");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  if (format === "json") {
    // Consumed by the Reports page to build a PDF client-side with
    // jspdf-autotable — jsPDF needs a browser canvas context, which the
    // Next.js server runtime doesn't reliably provide.
    return NextResponse.json({ rows });
  }

  return NextResponse.json({ error: "Unsupported format. Use csv, xlsx, or json." }, { status: 400 });
}
