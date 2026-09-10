"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Plus, GraduationCap, Users, MoreVertical, UserPlus, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StudentCardSkeleton } from "@/components/shared/LoadingSkeleton";
import { StudentFormDialog } from "@/components/admin/StudentFormDialog";
import { AssignVolunteersDialog } from "@/components/admin/AssignVolunteersDialog";
import { useDebounce } from "@/hooks/useDebounce";
import { useStudents } from "@/hooks/useStudents";
import { LEVEL_LABELS } from "@/lib/utils";
import type { Student, Volunteer } from "@/lib/types/database";

const LEVELS = ["beginner", "developing", "proficient", "advanced"];

/**
 * Generic, identical-for-every-student photo. Intentionally never uses
 * student.photo_url or initials — see prompt item 4 ("a generic photo,
 * identical for every student").
 */
function GenericStudentAvatar() {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <GraduationCap className="h-5 w-5" />
    </div>
  );
}

export function StudentsTable({
  volunteers,
  assignedVolunteerNames,
}: {
  volunteers: Volunteer[];
  /** studentId -> assigned volunteers' display names, fetched in bulk server-side (see admin/people/students/page.tsx). */
  assignedVolunteerNames: Record<string, string[]>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState<string>("all");
  const [englishLevel, setEnglishLevel] = useState<string>("all");
  const debouncedSearch = useDebounce(search, 250);

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      grade: grade !== "all" ? Number(grade) : undefined,
      englishLevel: englishLevel !== "all" ? (englishLevel as Student["english_level"]) : undefined,
    }),
    [debouncedSearch, grade, englishLevel]
  );

  const { students, isLoading, refetch } = useStudents(filters);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState<Student | null>(null);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  async function openAssign(student: Student) {
    setAssigningStudent(student);
    const res = await fetch(`/api/assignments?studentId=${student.id}`);
    if (res.ok) {
      const { assignments } = await res.json();
      setAssignedIds(assignments.map((a: { volunteer_id: string }) => a.volunteer_id));
    } else {
      setAssignedIds([]);
    }
    setAssignOpen(true);
  }

  async function handleDelete(student: Student) {
    const res = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Student removed");
      refetch();
    } else {
      toast.error("Failed to remove student");
      throw new Error("Failed to remove student");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Grade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All grades</SelectItem>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={englishLevel} onValueChange={setEnglishLevel}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="English level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All English levels</SelectItem>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l} className="capitalize">{LEVEL_LABELS[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEditingStudent(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add student
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StudentCardSkeleton key={i} />
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState icon={Users} title="No students found" description="Try adjusting your search or filters, or add a new student." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => {
            const assignedNames = assignedVolunteerNames[student.id] ?? [];
            return (
              <Card key={student.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <GenericStudentAvatar />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-semibold">{student.name}</p>
                      <p className="text-xs text-muted-foreground">Grade {student.grade}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Actions for ${student.name}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openAssign(student)}>
                        <UserPlus className="h-4 w-4" /> Assign volunteers
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingStudent(student);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteTarget(student)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  <span>
                    <span className="text-muted-foreground">English: </span>
                    <span className="capitalize">{LEVEL_LABELS[student.english_level]}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Math: </span>
                    <span className="capitalize">{LEVEL_LABELS[student.math_level]}</span>
                  </span>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">Volunteers assigned</p>
                  {assignedNames.length > 0 ? (
                    <p className="text-sm">{assignedNames.join(", ")}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">None assigned yet</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <StudentFormDialog open={formOpen} onOpenChange={setFormOpen} student={editingStudent} onSaved={refetch} />
      <AssignVolunteersDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        student={assigningStudent}
        allVolunteers={volunteers}
        currentlyAssignedIds={assignedIds}
        onSaved={() => {
          refetch();
          // assignedVolunteerNames is fetched server-side in the parent page,
          // so refresh the server component to pick up the new assignment.
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this student?"
        description={deleteTarget ? `Remove ${deleteTarget.name}? Their progress history is preserved.` : ""}
        confirmLabel="Remove student"
        onConfirm={() => {
          if (deleteTarget) return handleDelete(deleteTarget);
        }}
      />
    </div>
  );
}
