"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { displayName } from "@/lib/utils";
import { volunteerProfileSchema, type VolunteerProfileFormValues } from "@/lib/validations/volunteerProfile";
import type { Volunteer } from "@/lib/types/database";

export function VolunteerProfileEditor({
  volunteer,
  isSelf,
  open,
  onOpenChange,
  onSaved,
}: {
  volunteer: Volunteer;
  /** Whether the viewer is editing their own profile (hits /api/profile) vs an admin editing someone else's (hits /api/volunteers/:id). */
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Volunteer) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(volunteer.avatar_url);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VolunteerProfileFormValues>({
    resolver: zodResolver(volunteerProfileSchema),
    defaultValues: {
      name: volunteer.name,
      preferred_name: volunteer.preferred_name ?? "",
      bio: volunteer.bio ?? "",
      teaching_interests: volunteer.teaching_interests ?? "",
      fun_fact: volunteer.fun_fact ?? "",
      date_of_birth: volunteer.date_of_birth ?? "",
    },
  });

  const endpoint = isSelf ? "/api/profile" : `/api/volunteers/${volunteer.id}`;

  async function patchProfile(patch: Partial<VolunteerProfileFormValues>) {
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to update profile");
    }
    const body = await res.json();
    return body.volunteer as Volunteer;
  }

  async function handleAvatarChange(url: string | null) {
    const updated = await patchProfile({ avatar_url: url ?? "" });
    setAvatarUrl(updated.avatar_url);
    onSaved(updated);
  }

  async function onSubmit(values: VolunteerProfileFormValues) {
    setIsSaving(true);
    try {
      const updated = await patchProfile(values);
      toast.success("Profile updated");
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            {isSelf
              ? "This is how you'll appear throughout EduTrack."
              : `Editing ${displayName(volunteer)}'s profile information.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Rendered whenever this dialog is open at all — the page only ever
              opens it for the volunteer themself or an admin, matching the
              avatars_owner_or_admin_* Storage policies. */}
          <AvatarUploader
            volunteerId={volunteer.id}
            currentAvatarUrl={avatarUrl}
            altName={displayName(volunteer)}
            onUploaded={handleAvatarChange}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Official name</Label>
            <Input id="name" {...register("name")} placeholder={volunteer.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preferred_name">Preferred name</Label>
            <Input id="preferred_name" {...register("preferred_name")} placeholder={volunteer.name} />
            <p className="text-xs text-muted-foreground">What you'd like to be called. Leave blank to use your official name, {volunteer.name}.</p>
            {errors.preferred_name && <p className="text-xs text-destructive">{errors.preferred_name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} {...register("bio")} placeholder="A little about you..." />
            {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="teaching_interests">Teaching interests</Label>
            <Textarea id="teaching_interests" rows={2} {...register("teaching_interests")} placeholder="Subjects or topics you enjoy teaching" />
            {errors.teaching_interests && <p className="text-xs text-destructive">{errors.teaching_interests.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fun_fact">Fun fact</Label>
            <Input id="fun_fact" {...register("fun_fact")} placeholder="Something fun about you" />
            {errors.fun_fact && <p className="text-xs text-destructive">{errors.fun_fact.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date_of_birth">Date of birth</Label>
            <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
            <p className="text-xs text-muted-foreground">Only used for birthday recognition later — your age is never shown.</p>
            {errors.date_of_birth && <p className="text-xs text-destructive">{errors.date_of_birth.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
