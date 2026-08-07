"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { studentSchema, type StudentFormValues } from "@/lib/validations/student";
import type { Student } from "@/lib/types/database";

const LEVELS = ["beginner", "developing", "proficient", "advanced"] as const;
const GRADES = Array.from({ length: 10 }, (_, i) => i + 1);

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student | null;
  onSaved: () => void;
}

/** Add/edit dialog for a student, used from the admin students table. */
export function StudentFormDialog({ open, onOpenChange, student, onSaved }: StudentFormDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = Boolean(student);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: "",
      grade: 1,
      english_level: "beginner",
      math_level: "beginner",
      photo_url: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        student
          ? {
              name: student.name,
              grade: student.grade,
              english_level: student.english_level,
              math_level: student.math_level,
              photo_url: student.photo_url ?? "",
            }
          : { name: "", grade: 1, english_level: "beginner", math_level: "beginner", photo_url: "" }
      );
    }
  }, [open, student, reset]);

  async function onSubmit(values: StudentFormValues) {
    setIsSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/students/${student!.id}` : "/api/students", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save student");
      }
      toast.success(isEdit ? "Student updated" : "Student added");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit student" : "Add student"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this student's details." : "New students start with no progress history."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" {...register("name")} placeholder="e.g. Aarav Sharma" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Grade</Label>
              <Select value={String(watch("grade"))} onValueChange={(v) => setValue("grade", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>English level</Label>
              <Select value={watch("english_level")} onValueChange={(v) => setValue("english_level", v as StudentFormValues["english_level"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Math level</Label>
              <Select value={watch("math_level")} onValueChange={(v) => setValue("math_level", v as StudentFormValues["math_level"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photo_url">Photo URL (optional)</Label>
            <Input id="photo_url" {...register("photo_url")} placeholder="https://..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
