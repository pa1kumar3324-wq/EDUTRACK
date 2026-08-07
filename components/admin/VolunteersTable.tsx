"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2, UserCog, MoreVertical, ShieldCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/EmptyState";
import { volunteerSchema, type VolunteerFormValues } from "@/lib/validations/roadmap";
import { initials } from "@/lib/utils";
import type { Volunteer } from "@/lib/types/database";

export function VolunteersTable({ initialVolunteers, studentCounts }: { initialVolunteers: Volunteer[]; studentCounts: Record<string, number> }) {
  const [volunteers, setVolunteers] = useState(initialVolunteers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      toast.success(`${v.name} is now ${newRole === "admin" ? "an admin" : "a volunteer"}`);
    } else {
      toast.error("Failed to update role");
    }
  }

  async function deactivate(v: Volunteer) {
    if (!confirm(`Deactivate ${v.name}? Their history stays, but they'll lose login access.`)) return;
    const res = await fetch(`/api/volunteers/${v.id}`, { method: "DELETE" });
    if (res.ok) {
      setVolunteers((prev) => prev.filter((x) => x.id !== v.id));
      toast.success("Volunteer deactivated");
    } else {
      toast.error("Failed to deactivate volunteer");
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Volunteer</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Students assigned</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {volunteers.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={v.avatar_url ?? undefined} alt={v.name} />
                      <AvatarFallback className="text-xs">{initials(v.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={v.role === "admin" ? "default" : "outline"} className="capitalize">{v.role}</Badge>
                </TableCell>
                <TableCell>{studentCounts[v.id] ?? 0}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggleRole(v)}>
                        <ShieldCheck className="h-4 w-4" /> {v.role === "admin" ? "Make volunteer" : "Make admin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deactivate(v)} className="text-destructive focus:text-destructive">
                        <UserX className="h-4 w-4" /> Deactivate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    </div>
  );
}
