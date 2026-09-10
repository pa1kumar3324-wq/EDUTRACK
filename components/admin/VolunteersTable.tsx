"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2, UserCog, MoreVertical, ShieldCheck, UserX, Cake, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import Link from "next/link";
import { volunteerSchema, type VolunteerFormValues } from "@/lib/validations/roadmap";
import { initials, displayName, isBirthdayUpcoming } from "@/lib/utils";
import type { Volunteer } from "@/lib/types/database";

export function VolunteersTable({ initialVolunteers, studentCounts }: { initialVolunteers: Volunteer[]; studentCounts: Record<string, number> }) {
  const [volunteers, setVolunteers] = useState(initialVolunteers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Volunteer | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VolunteerFormValues>({
    resolver: zodResolver(volunteerSchema),
    defaultValues: { name: "", email: "", phone: "", role: "volunteer" },
  });

  async function onInvite(values: VolunteerFormValues) {
    setIsSaving(true);
    try {
      const res = await fetch("/api/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to invite volunteer");
      }
      toast.success("Invite sent", { description: `${values.name} will receive a magic-link email.` });
      setInviteOpen(false);
      reset();
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleRole(v: Volunteer) {
    const newRole = v.role === "admin" ? "volunteer" : "admin";
    const res = await fetch(`/api/volunteers/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setVolunteers((prev) => prev.map((x) => (x.id === v.id ? { ...x, role: newRole } : x)));
      toast.success(`${displayName(v)} is now ${newRole === "admin" ? "an admin" : "a volunteer"}`);
    } else {
      toast.error("Failed to update role");
    }
  }

  async function deactivate(v: Volunteer) {
    const res = await fetch(`/api/volunteers/${v.id}`, { method: "DELETE" });
    if (res.ok) {
      setVolunteers((prev) => prev.filter((x) => x.id !== v.id));
      toast.success("Volunteer deactivated");
    } else {
      toast.error("Failed to deactivate volunteer");
      throw new Error("Failed to deactivate volunteer");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" /> Invite volunteer
        </Button>
      </div>

      {volunteers.length === 0 ? (
        <EmptyState icon={UserCog} title="No volunteers yet" description="Invite your first volunteer to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {volunteers.map((v) => {
            const showBirthdayBadge = !!v.date_of_birth && isBirthdayUpcoming(v.date_of_birth);
            return (
              <Card key={v.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={v.avatar_url ?? undefined} alt={displayName(v)} />
                      <AvatarFallback>{initials(displayName(v))}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-display font-semibold">{displayName(v)}</p>
                        {showBirthdayBadge && (
                          <Badge variant="outline" className="shrink-0 gap-1 px-1.5 py-0 text-[10px]">
                            <Cake className="h-3 w-3" /> Birthday
                          </Badge>
                        )}
                      </div>
                      <Badge variant={v.role === "admin" ? "default" : "outline"} className="mt-0.5 capitalize">{v.role}</Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Actions for ${displayName(v)}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggleRole(v)}>
                        <ShieldCheck className="h-4 w-4" /> {v.role === "admin" ? "Make volunteer" : "Make admin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeactivateTarget(v)} className="text-destructive focus:text-destructive">
                        <UserX className="h-4 w-4" /> Deactivate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="truncate text-xs text-muted-foreground">
                  {v.email} · {studentCounts[v.id] ?? 0} student{studentCounts[v.id] === 1 ? "" : "s"}
                </p>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">Teaching subject</p>
                  {v.teaching_interests ? (
                    <p className="text-sm">{v.teaching_interests}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No subject listed yet</p>
                  )}
                </div>

                <Button variant="outline" size="sm" className="mt-auto w-full" asChild>
                  <Link href={`/volunteers/${v.id}`}>
                    View profile <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a volunteer</DialogTitle>
            <DialogDescription>They'll receive a magic-link email to set up their account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onInvite)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" {...register("name")} placeholder="e.g. Priya Nair" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} placeholder="priya@example.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" {...register("phone")} placeholder="+91 98765 43210" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select value={watch("role")} onValueChange={(v) => setValue("role", v as VolunteerFormValues["role"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="animate-spin" />}
                Send invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate this volunteer?"
        description={deactivateTarget ? `Deactivate ${displayName(deactivateTarget)}? Their history stays, but they'll lose login access.` : ""}
        confirmLabel="Deactivate"
        onConfirm={() => {
          if (deactivateTarget) return deactivate(deactivateTarget);
        }}
      />
    </div>
  );
}
