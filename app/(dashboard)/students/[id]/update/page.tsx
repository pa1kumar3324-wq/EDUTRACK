import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { studentRepository } from "@/lib/repositories/studentRepository";
import { ProgressForm } from "@/components/progress/ProgressForm";
import { Button } from "@/components/ui/button";

export default async function UpdateProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  let student;
  try {
    student = await studentRepository.getById(supabase, id);
  } catch {
    notFound();
  }

  if (user.role === "volunteer") {
    const assigned = await studentRepository.assignedVolunteers(supabase, id);
    if (!assigned.some((v) => v.id === user.id)) redirect(`/students/${id}`);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/students/${id}`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
          </Link>
        </Button>
        <h1 className="font-display text-xl font-semibold">Update progress — {student.name}</h1>
        <p className="text-sm text-muted-foreground">Grade {student.grade}. This log becomes the next volunteer's starting point.</p>
      </div>

      <ProgressForm student={student} />
    </div>
  );
}
