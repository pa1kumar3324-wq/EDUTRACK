"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Plus, MoreVertical, Pencil, Trash2, UserPlus, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/EmptyState";
import { StudentCardSkeleton } from "@/components/shared/LoadingSkeleton";
import { StudentFormDialog } from "@/components/admin/StudentFormDialog";
import { AssignVolunteersDialog } from "@/components/admin/AssignVolunteersDialog";
import { useDebounce } from "@/hooks/useDebounce";
import { useStudents } from "@/hooks/useStudents";
import { initials, LEVEL_LABELS } from "@/lib/utils";
import { Users } from "lucide-react";
import type { Student, Volunteer } from "@/lib/types/database";

const LEVELS = ["beginner", "developing", "proficient", "advanced"];

export function StudentsTable({ volunteers }: { volunteers: Volunteer[] }) {
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
    if (!confirm(`Remove ${student.name}? Their progress history is preserved.`)) return;
    const res = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Student removed");
      refetch();
    } else {
      toast.error("Failed to remove student");
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>English</TableHead>
              <TableHead>Math</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={student.photo_url ?? undefined} alt={student.name} />
                      <AvatarFallback className="text-xs">{initials(student.name)}</AvatarFallback>
                    </Avatar>
                    <Link href={`/students/${student.id}`} className="font-medium hover:underline">
                      {student.name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>Grade {student.grade}</TableCell>
                <TableCell className="capitalize">{LEVEL_LABELS[student.english_level]}</TableCell>
                <TableCell className="capitalize">{LEVEL_LABELS[student.math_level]}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/students/${student.id}`}><Eye className="h-4 w-4" /> View profile</Link>
                      </DropdownMenuItem>
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
                      <DropdownMenuItem onClick={() => handleDelete(student)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <StudentFormDialog open={formOpen} onOpenChange={setFormOpen} student={editingStudent} onSaved={refetch} />
      <AssignVolunteersDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        student={assigningStudent}
        allVolunteers={volunteers}
        currentlyAssignedIds={assignedIds}
        onSaved={refetch}
      />
    </div>
  );
}
