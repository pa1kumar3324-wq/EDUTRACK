import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/** Every ISO date ("YYYY-MM-DD") from `from` to `to`, inclusive. */
function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * GET /api/export?format=csv|xlsx|json&type=students|progress|attendance — admin only.
 * Streams back the requested file as a download (json is used internally to
 * build client-side PDFs — see the Reports page's ExportPanel).
 *
 * Attendance is exported as a register: one row per volunteer, one column
 * per date in [from, to], with that volunteer's status in each cell (blank
 * if no attendance record exists for that day).
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
    const dates = dateRange(from!, to!);

    const [{ data: volunteers, error: volunteersError }, { data: records, error: recordsError }] =
      await Promise.all([
        supabase.from("volunteers").select("id, name").eq("is_active", true).order("name"),
        supabase
          .from("attendance")
          .select("volunteer_id, session_date, status")
          .gte("session_date", from!)
          .lte("session_date", to!),
      ]);
    if (volunteersError) return NextResponse.json({ error: volunteersError.message }, { status: 500 });
    if (recordsError) return NextResponse.json({ error: recordsError.message }, { status: 500 });

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
        row[date] = byDate?.get(date) ?? "";
      }
      return row;
    });
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
