import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * GET /api/export?format=csv|xlsx|pdf&type=students|progress — admin only.
 * Streams back the requested file as a download.
 */
export async function GET(request: Request) {
  await requireAdmin();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const type = searchParams.get("type") ?? "students";

  let rows: Record<string, unknown>[] = [];
  const filename = `edutrack-${type}`;

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
  } else {
    const { data, error } = await supabase
      .from("progress")
      .select("created_at, english_topic, english_status, math_topic, math_status, homework, students(name), volunteers(name)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows = (data ?? []).map((p) => {
      const row = p as unknown as {
        created_at: string;
        english_topic: string | null;
        english_status: string | null;
        math_topic: string | null;
        math_status: string | null;
        homework: string | null;
        students: { name: string } | null;
        volunteers: { name: string } | null;
      };
      return {
        Date: new Date(row.created_at).toLocaleDateString(),
        Student: row.students?.name ?? "",
        Volunteer: row.volunteers?.name ?? "",
        "English Topic": row.english_topic ?? "",
        "English Status": row.english_status ?? "",
        "Math Topic": row.math_topic ?? "",
        "Math Status": row.math_status ?? "",
        Homework: row.homework ?? "",
      };
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
    XLSX.utils.book_append_sheet(workbook, worksheet, type === "students" ? "Students" : "Progress");
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
