import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { SearchResultItem } from "@/lib/types";

/**
 * GET /api/search?q=
 * Global search across student name, grade, and (admin-only) volunteer name.
 * Volunteers only ever see their own assigned students — same visibility rule
 * as the dashboard.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createClient();
  const results: SearchResultItem[] = [];
  const numericGrade = /^\d+$/.test(q) ? Number(q) : null;

  let studentQuery = supabase
    .from("students")
    .select("id, name, grade")
    .eq("is_active", true)
    .limit(6);

  studentQuery = numericGrade !== null
    ? studentQuery.or(`name.ilike.%${q}%,grade.eq.${numericGrade}`)
    : studentQuery.ilike("name", `%${q}%`);

  if (user.role !== "admin") {
    const { data: assignmentRows } = await supabase
      .from("assignments")
      .select("student_id")
      .eq("volunteer_id", user.id);
    const assignedIds = (assignmentRows ?? []).map((a) => a.student_id);
    if (assignedIds.length === 0) {
      return NextResponse.json({ results: [] });
    }
    studentQuery = studentQuery.in("id", assignedIds);
  }

  const { data: students } = await studentQuery;
  for (const s of students ?? []) {
    results.push({
      type: "student",
      id: s.id,
      label: s.name,
      sublabel: `Grade ${s.grade}`,
      href: `/students/${s.id}`,
    });
  }

  if (user.role === "admin") {
    const { data: volunteers } = await supabase
      .from("volunteers")
      .select("id, name, email")
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .limit(5);
    for (const v of volunteers ?? []) {
      results.push({
        type: "volunteer",
        id: v.id,
        label: v.name,
        sublabel: v.email,
        href: `/admin/volunteers`,
      });
    }
  }

  return NextResponse.json({ results });
}
