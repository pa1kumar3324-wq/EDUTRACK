"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2, MoreVertical, UserPlus, Trash2, ShieldCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { learningCircleSchema, type LearningCircleFormValues } from "@/lib/validations/learningCircle";
import { initials, displayName } from "@/lib/utils";
import type { LearningCircleDetail, PublicVolunteer } from "@/lib/types/database";

interface LearningCirclesPanelProps {
  initialCircles: LearningCircleDetail[];
  /** Every active volunteer (admins included — an admin can also be taught-side staff). */
  volunteers: PublicVolunteer[];
  /** Active admins only; the lead must be one (also DB-enforced). */
  admins: PublicVolunteer[];
}

/**
 * Admin workspace for Learning Circles.
 *
 * A circle groups existing volunteers under one lead admin, who then
 * verifies the class debriefs those volunteers file. Membership is
 * exclusive — a volunteer belongs to at most one circle — so that every
 * debrief has exactly one unambiguous verifier. The member picker reflects
 * that by showing which other circle a volunteer is already in and
 * disabling them, rather than letting the admin submit a roster the server
 * will reject with a 409.
 */
export function LearningCirclesPanel({ initialCircles, volunteers, admins }: LearningCirclesPanelProps) {
  const [circles, setCircles] = useState(initialCircles);
  const [createOpen, setCreateOpen] = useState(false);
  const [membersTarget, setMembersTarget] = useState<LearningCircleDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LearningCircleDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /** volunteerId -> the circle they're already in. Drives the picker's disabled state. */
  const circleByVolunteerId = useMemo(() => {
    const map = new Map<string, LearningCircleDetail>();
    for (const circle of circles) {
      for (const member of circle.learning_circle_members ?? []) {
        map.set(member.volunteer_id, circle);
      }
    }
    return map;
  }, [circles]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LearningCircleFormValues>({
    resolver: zodResolver(learningCircleSchema),
    defaultValues: { name: "", description: "", lead_admin_id: "", member_ids: [] },
  });

  async function onCreate(values: LearningCircleFormValues) {
    setIsSaving(true);
    try {
      const res = await fetch("/api/learning-circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to create Learning Circle");

      setCircles((prev) => [body.circle as LearningCircleDetail, ...prev]);
      toast.success("Learning Circle created", {
        description: `${values.name} is ready. Its members' debriefs now route to its lead for verification.`,
      });
      setCreateOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveMembers(circle: LearningCircleDetail, volunteerIds: string[]) {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/learning-circles/${circle.id}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volunteer_ids: volunteerIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to update members");

      const updated = body.circle as LearningCircleDetail;
      setCircles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success("Members updated", {
        description: `${updated.learning_circle_members?.length ?? 0} volunteer(s) in ${updated.name}.`,
      });
      setMembersTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function changeLead(circle: LearningCircleDetail, leadAdminId: string) {
    const res = await fetch(`/api/learning-circles/${circle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_admin_id: leadAdminId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.error ?? "Failed to change lead");
      return;
    }
    const updated = body.circle as LearningCircleDetail;
    setCircles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    toast.success(`${updated.lead ? displayName(updated.lead) : "New lead"} now verifies ${updated.name}`, {
      description: "Any debriefs already waiting move to their queue.",
    });
  }

  async function deactivate(circle: LearningCircleDetail) {
    const res = await fetch(`/api/learning-circles/${circle.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete Learning Circle");
      throw new Error("Failed to delete Learning Circle");
    }
    setCircles((prev) => prev.filter((c) => c.id !== circle.id));
    toast.success("Learning Circle removed", {
      description: "Its members' future debriefs record immediately again. Anything already in review stays verifiable.",
    });
  }

  const selectedMemberIds = watch("member_ids") ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A Learning Circle groups volunteers under one lead admin. Debriefs filed by its members wait for
          that lead to verify them before they count toward a student&apos;s record. Volunteers outside every
          circle keep logging as they do today, with nothing to approve.
        </p>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="h-3.5 w-3.5" /> New circle
        </Button>
      </div>

      {circles.length === 0 ? (
        <EmptyState
          title="No Learning Circles yet"
          description="Create one to group volunteers under an admin who verifies their class debriefs."
          action={
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="h-3.5 w-3.5" /> New circle
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {circles.map((circle) => {
            const members = circle.learning_circle_members ?? [];
            return (
              <Card key={circle.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{circle.name}</p>
                    {circle.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{circle.description}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setMembersTarget(circle)}>
                        <UserPlus className="h-3.5 w-3.5" /> Manage members
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(circle)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete circle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    <ShieldCheck className="h-3 w-3" />
                    Lead: {circle.lead ? displayName(circle.lead) : "—"}
                  </Badge>
                  <Badge variant="outline">
                    {members.length} member{members.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                {members.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {members.slice(0, 8).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pl-0.5 pr-2.5"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage
                            src={m.volunteers?.avatar_url ?? undefined}
                            alt={m.volunteers ? displayName(m.volunteers) : ""}
                          />
                          <AvatarFallback className="text-[9px]">
                            {initials(m.volunteers ? displayName(m.volunteers) : "?")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">
                          {m.volunteers ? displayName(m.volunteers) : "Unknown"}
                        </span>
                      </div>
                    ))}
                    {members.length > 8 && (
                      <span className="self-center text-xs text-muted-foreground">
                        +{members.length - 8} more
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-auto flex items-center gap-2 pt-1">
                  <Label className="text-xs text-muted-foreground">Verified by</Label>
                  <Select value={circle.lead_admin_id} onValueChange={(v) => changeLead(circle, v)}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {admins.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {displayName(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Create                                                            */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Learning Circle</DialogTitle>
            <DialogDescription>
              Pick a lead admin and the volunteers whose debriefs they&apos;ll verify.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="lc-name">Name</Label>
              <Input id="lc-name" placeholder="Saturday Circle A" {...register("name")} />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="lc-description">Description (optional)</Label>
              <Textarea
                id="lc-description"
                rows={2}
                placeholder="Which cohort or centre this circle covers."
                {...register("description")}
              />
            </div>

            <div>
              <Label>Lead admin</Label>
              <Select
                value={watch("lead_admin_id") || undefined}
                onValueChange={(v) => setValue("lead_admin_id", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Who verifies this circle's debriefs?" />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {displayName(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lead_admin_id && (
                <p className="mt-1 text-xs text-destructive">{errors.lead_admin_id.message}</p>
              )}
              {admins.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  No admins available. Promote a volunteer to admin first.
                </p>
              )}
            </div>

            <div>
              <Label>Members ({selectedMemberIds.length} selected)</Label>
              <VolunteerPicker
                volunteers={volunteers}
                circleByVolunteerId={circleByVolunteerId}
                selected={new Set(selectedMemberIds)}
                onToggle={(id) => {
                  const next = new Set(selectedMemberIds);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  setValue("member_ids", [...next], { shouldDirty: true });
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button onClick={handleSubmit(onCreate)} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Create circle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Manage members                                                     */}
      {/* ---------------------------------------------------------------- */}
      <ManageMembersDialog
        circle={membersTarget}
        volunteers={volunteers}
        circleByVolunteerId={circleByVolunteerId}
        isSaving={isSaving}
        onClose={() => setMembersTarget(null)}
        onSave={saveMembers}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "this circle"}?`}
        description="Its members go back to having their debriefs recorded immediately. Debriefs already awaiting verification stay in the lead's queue so nothing in review is lost."
        confirmLabel="Delete circle"
        onConfirm={() => (deleteTarget ? deactivate(deleteTarget) : Promise.resolve())}
      />
    </div>
  );
}

/**
 * Member picker shared by the create and manage dialogs.
 *
 * A volunteer already in ANOTHER circle is shown but disabled, with that
 * circle named. Membership is exclusive at the database level, so silently
 * allowing the selection would just produce a 409 on save — better to
 * explain the conflict at the point of the click.
 */
function VolunteerPicker({
  volunteers,
  circleByVolunteerId,
  selected,
  onToggle,
  currentCircleId,
}: {
  volunteers: PublicVolunteer[];
  circleByVolunteerId: Map<string, LearningCircleDetail>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  currentCircleId?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return volunteers;
    return volunteers.filter(
      (v) => displayName(v).toLowerCase().includes(q) || v.email.toLowerCase().includes(q)
    );
  }, [volunteers, query]);

  return (
    <div className="mt-1 flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search volunteers"
          className="h-9 pl-8"
        />
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No volunteers found.</p>
        ) : (
          filtered.map((v) => {
            const otherCircle = circleByVolunteerId.get(v.id);
            const blocked = Boolean(otherCircle && otherCircle.id !== currentCircleId);
            return (
              <label
                key={v.id}
                className={
                  blocked
                    ? "flex cursor-not-allowed items-center gap-3 rounded-lg px-2 py-2 opacity-60"
                    : "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary"
                }
              >
                <Checkbox
                  checked={selected.has(v.id)}
                  disabled={blocked}
                  onCheckedChange={() => !blocked && onToggle(v.id)}
                />
                <Avatar className="h-7 w-7">
                  <AvatarImage src={v.avatar_url ?? undefined} alt={displayName(v)} />
                  <AvatarFallback className="text-[10px]">{initials(displayName(v))}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {displayName(v)}
                    {v.role === "admin" && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">admin</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {blocked ? `Already in ${otherCircle?.name}` : v.email}
                  </p>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function ManageMembersDialog({
  circle,
  volunteers,
  circleByVolunteerId,
  isSaving,
  onClose,
  onSave,
}: {
  circle: LearningCircleDetail | null;
  volunteers: PublicVolunteer[];
  circleByVolunteerId: Map<string, LearningCircleDetail>;
  isSaving: boolean;
  onClose: () => void;
  onSave: (circle: LearningCircleDetail, volunteerIds: string[]) => void;
}) {
  const initial = useMemo(
    () => new Set((circle?.learning_circle_members ?? []).map((m) => m.volunteer_id)),
    [circle]
  );
  const [selected, setSelected] = useState<Set<string>>(initial);

  // Re-seed whenever a different circle is opened. Keyed remount would also
  // work, but this keeps the dialog mounted for its close animation.
  const [seededFor, setSeededFor] = useState<string | null>(circle?.id ?? null);
  if (circle && seededFor !== circle.id) {
    setSeededFor(circle.id);
    setSelected(initial);
  }

  return (
    <Dialog open={Boolean(circle)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members of {circle?.name}</DialogTitle>
          <DialogDescription>
            {circle?.lead
              ? `${displayName(circle.lead)} verifies every debrief these volunteers file.`
              : "Choose which volunteers belong to this circle."}
          </DialogDescription>
        </DialogHeader>

        <VolunteerPicker
          volunteers={volunteers}
          circleByVolunteerId={circleByVolunteerId}
          selected={selected}
          currentCircleId={circle?.id}
          onToggle={(id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => circle && onSave(circle, [...selected])}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save members
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
