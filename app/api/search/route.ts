import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUserApi } from "@/lib/api/requireAuth";
import { apiError } from "@/lib/api/errors";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { displayName } from "@/lib/utils";
import type { SearchResultItem } from "@/lib/types";

/**
 * GET /api/search?q=
 * Global search across student name, grade, and (admin-only) volunteer name.
 * Volunteers only ever see their own assigned students — same visibility rule
 * as the dashboard.
 */
export async function GET(request: Request) {
  try {
    // Rate limited: this runs an ILIKE query per keystroke from the
    // client, so it's the cheapest endpoint to abuse for load. 60
    // requests/minute per IP comfortably covers real typing speed.
    const { allowed, retryAfterSeconds } = checkRateLimit(`search:${getClientIp(request)}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const user = await requireUserApi();
    const { searchParams } = new URL(request.url);
    // ilike patterns below are built from `q` — Postgres wildcard metachars
    // (% and _) are escaped so a search string can't inject unintended
    // wildcard matches (e.g. searching "%" would otherwise match everyone).
    const rawQ = (searchParams.get("q") ?? "").trim();
    const q = rawQ.replace(/[%_]/g, (c) => `\\${c}`);

    if (rawQ.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const supabase = await createClient();
    const results: SearchResultItem[] = [];
    const numericGrade = /^\d+$/.test(rawQ) ? Number(rawQ) : null;

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
        .select("id, name, preferred_name, email")
        .eq("is_active", true)
        .or(`name.ilike.%${q}%,preferred_name.ilike.%${q}%`)
        .limit(5);
      for (const v of volunteers ?? []) {
        results.push({
          type: "volunteer",
          id: v.id,
          label: displayName(v),
          sublabel: v.email,
          href: `/volunteers/${v.id}`,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return apiError(error);
  }
}
