import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, BookOpen, Cake, Users, CalendarCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { attendanceRepository } from "@/lib/repositories/attendanceRepository";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VolunteerProfileHeader } from "@/components/profile/VolunteerProfileHeader";
import type { Volunteer } from "@/lib/types/database";

/** Formats a "YYYY-MM-DD" DOB as e.g. "June 14" — month/day only, never the year, so age is never implied. */
function formatBirthday(dateOfBirth: string): string {
  const parts = dateOfBirth.split("-").map(Number);
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const d = new Date(Date.UTC(2000, month - 1, day));
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export default async function VolunteerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  let volunteer: Volunteer;
  try {
    volunteer = (await volunteerRepository.getById(supabase, id)) as Volunteer;
  } catch {
    notFound();
  }

  const isSelf = user.id === volunteer.id;
  const canEdit = isSelf || user.role === "admin";
  const canSeePrivateStats = isSelf || user.role === "admin";

  const { count: studentsAssigned } = await supabase
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("volunteer_id", volunteer.id);

  const attendanceSummary = canSeePrivateStats
    ? await attendanceRepository.summaryForVolunteer(supabase, volunteer.id)
    : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href={user.role === "admin" ? "/admin/people/volunteers" : "/dashboard"}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </Button>

      <Card>
        <CardContent className="pt-6">
          <VolunteerProfileHeader initialVolunteer={volunteer} isSelf={isSelf} canEdit={canEdit} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Students</div>
            <p className="font-display text-xl font-semibold">{studentsAssigned ?? 0}</p>
          </CardContent>
        </Card>
        {attendanceSummary && (
          <Card>
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarCheck className="h-3.5 w-3.5" /> Attendance rate</div>
              <p className="font-display text-xl font-semibold">{attendanceSummary.attendanceRate}%</p>
            </CardContent>
          </Card>
        )}
        {canSeePrivateStats && volunteer.date_of_birth && (
          <Card>
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Cake className="h-3.5 w-3.5" /> Birthday</div>
              <p className="font-display text-xl font-semibold">{formatBirthday(volunteer.date_of_birth)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {(volunteer.bio || volunteer.teaching_interests || volunteer.fun_fact) ? (
        <div className="flex flex-col gap-3">
          {volunteer.bio && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Bio</CardTitle></CardHeader>
              <CardContent className="whitespace-pre-line text-sm text-muted-foreground">{volunteer.bio}</CardContent>
            </Card>
          )}
          {volunteer.teaching_interests && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Teaching interests</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-line text-sm text-muted-foreground">{volunteer.teaching_interests}</CardContent>
            </Card>
          )}
          {volunteer.fun_fact && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Fun fact</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{volunteer.fun_fact}</CardContent>
            </Card>
          )}
        </div>
      ) : (
        canEdit && (
          <p className="text-sm text-muted-foreground">
            {isSelf ? "Add a bio, teaching interests, or a fun fact so others get to know you." : `${volunteer.name} hasn't filled out a profile yet.`}
          </p>
        )
      )}
    </div>
  );
}
