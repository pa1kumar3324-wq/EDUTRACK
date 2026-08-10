import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import {
  roadmapPositionSchema,
  roadmapPositionSubjectQuerySchema,
} from "@/lib/validations/roadmapPosition";
import { studentRepository } from "@/lib/repositories/studentRepository";
import { roadmapRepository } from "@/lib/repositories/roadmapRepository";
import { studentRoadmapPositionRepository } from "@/lib/repositories/studentRoadmapPositionRepository";

/**
 * GET /api/students/:id/roadmap-position?subject=english|math
 * Any authenticated user may read — volunteers need this to render the
 * student's roadmap the same way leaders do. Returns { position: null } when
 * no leader-set starting point exists (automatic recommendation applies).
 *
 * NOTE: this returns the raw baseline row, not the resolved current
 * position — callers that need "where is the student right now" must run
 * this through resolveRoadmapPosition() (see lib/utils/roadmapEngine.ts),
 * since progress recorded after the baseline can advance the student past
 * it via the normal automatic engine.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const parsed = roadmapPositionSubjectQuerySchema.safeParse({
    subject: searchParams.get("subject"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "A valid 'subject' query param (english|math) is required" },
      { status: 400 }
    );
  }

  try {
    const position = await studentRoadmapPositionRepository.getForStudentSubject(
      supabase,
      id,
      parsed.data.subject
    );
    return NextResponse.json({ position });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/students/:id/roadmap-position — admin only.
 * Sets (creates or replaces) the student's roadmap STARTING BASELINE for
 * one subject — "start this student's roadmap here", not a permanent pin.
 * Once progress is recorded at or beyond this topic, automatic
 * recommendation (resolveRoadmapPosition -> recommendNextTopic) advances
 * the student past it as usual. Never touches `progress` history — purely
 * a pointer into `learning_roadmap`.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => null);

  const parsed = roadmapPositionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { subject, roadmap_id } = parsed.data;

  try {
    let student;
    try {
      student = await studentRepository.getById(supabase, id);
    } catch {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Validate the roadmap topic exists, and belongs to both the requested
    // subject and the student's CURRENT grade — never let a leader pin a
    // topic from another grade or the wrong subject.
    const gradeRoadmap = await roadmapRepository.listByGrade(supabase, student.grade);
    const targetEntry = gradeRoadmap.find((r) => r.id === roadmap_id);

    if (!targetEntry) {
      return NextResponse.json(
        { error: `That roadmap topic does not belong to Grade ${student.grade}.` },
        { status: 400 }
      );
    }
    if (targetEntry.subject !== subject) {
      return NextResponse.json(
        { error: `That roadmap topic belongs to ${targetEntry.subject}, not ${subject}.` },
        { status: 400 }
      );
    }

    const position = await studentRoadmapPositionRepository.upsert(
      supabase,
      { student_id: id, subject, roadmap_id },
      admin.id
    );

    return NextResponse.json({ position }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/students/:id/roadmap-position?subject=english|math — admin only.
 * Removes the leader-set starting baseline, so the student's position is
 * determined purely by actual progress history from here on. Does not
 * touch `progress` history.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const parsed = roadmapPositionSubjectQuerySchema.safeParse({
    subject: searchParams.get("subject"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "A valid 'subject' query param (english|math) is required" },
      { status: 400 }
    );
  }

  try {
    await studentRoadmapPositionRepository.clear(supabase, id, parsed.data.subject);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
