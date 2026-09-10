"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VolunteerProfileEditor } from "@/components/profile/VolunteerProfileEditor";
import { displayName, initials } from "@/lib/utils";
import type { Volunteer } from "@/lib/types/database";

export function VolunteerProfileHeader({
  initialVolunteer,
  isSelf,
  canEdit,
}: {
  initialVolunteer: Volunteer;
  isSelf: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [volunteer, setVolunteer] = useState(initialVolunteer);
  const [editOpen, setEditOpen] = useState(false);
  const [hintSeen, setHintSeen] = useState(true);

  const hintStorageKey = `edutrack:profile-hint-seen:${initialVolunteer.id}`;

  useEffect(() => {
    if (!isSelf) return;
    setHintSeen(!!localStorage.getItem(hintStorageKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelf]);

  function dismissHint() {
    localStorage.setItem(hintStorageKey, "1");
    setHintSeen(true);
  }

  const showOfficialName =
    !!volunteer.preferred_name?.trim() && volunteer.preferred_name.trim() !== volunteer.name;

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <Avatar className="h-20 w-20 border border-border">
        <AvatarImage src={volunteer.avatar_url ?? undefined} alt={displayName(volunteer)} />
        <AvatarFallback className="text-xl">{initials(displayName(volunteer))}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{displayName(volunteer)}</h1>
          <Badge variant={volunteer.role === "admin" ? "default" : "outline"} className="capitalize">{volunteer.role}</Badge>
          {!volunteer.is_active && <Badge variant="destructive">Inactive</Badge>}
        </div>
        {showOfficialName && (
          <p className="text-sm text-muted-foreground">Official name: {volunteer.name}</p>
        )}
        <p className="text-sm text-muted-foreground">{volunteer.email}</p>
      </div>

      {canEdit && (
        <>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (isSelf && !hintSeen) dismissHint();
                setEditOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit profile
            </Button>
            {isSelf && !hintSeen && (
              <Badge variant="default" className="px-1.5 py-0 text-[10px]">New</Badge>
            )}
          </div>
          <VolunteerProfileEditor
            volunteer={volunteer}
            isSelf={isSelf}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSaved={(updated) => {
              setVolunteer(updated);
              router.refresh();
            }}
          />
        </>
      )}
    </div>
  );
}
