import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import {
  PUBLIC_VOLUNTEER_COLUMNS,
  type LearningCircle,
  type LearningCircleDetail,
  type PendingDebrief,
} from "@/lib/types/database";
import type { LearningCircleFormValues, LearningCircleUpdateValues } from "@/lib/validations/learningCircle";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Only the public volunteer projection is ever joined in here — circles and
 * their debrief queues are read by admins, but the same shapes flow into
 * client components, so `phone`/`date_of_birth` stay out of the payload
 * (same rule as assignmentRepository, see H1).
 */
const CIRCLE_SELECT = `
  *,
  lead:volunteers!learning_circles_lead_admin_id_fkey(${PUBLIC_VOLUNTEER_COLUMNS}),
  learning_circle_members(
    *,
    volunteers!learning_circle_members_volunteer_id_fkey(${PUBLIC_VOLUNTEER_COLUMNS})
  )
`;

export const learningCircleRepository = {
  /** All active circles with their lead and full roster, newest first. */
  async list(supabase: Client): Promise<LearningCircleDetail[]> {
    const { data, error } = await supabase
      .from("learning_circles")
      .select(CIRCLE_SELECT)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as LearningCircleDetail[];
  },

  async getById(supabase: Client, id: string): Promise<LearningCircleDetail> {
    const { data, error } = await supabase
      .from("learning_circles")
      .select(CIRCLE_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Learning Circle not found");
    return data as unknown as LearningCircleDetail;
  },

  /**
   * The active circle a given volunteer belongs to, or null. Drives the
   * "your debriefs need verification by X" messaging on the volunteer side.
   */
  async forVolunteer(supabase: Client, volunteerId: string) {
    const { data, error } = await supabase
      .from("learning_circle_members")
      .select(
        `circle_id, learning_circles!learning_circle_members_circle_id_fkey(*, lead:volunteers!learning_circles_lead_admin_id_fkey(${PUBLIC_VOLUNTEER_COLUMNS}))`
      )
      .eq("volunteer_id", volunteerId)
      .maybeSingle();
    if (error) throw error;
    const circle = (data as unknown as { learning_circles: LearningCircleDetail | null } | null)
      ?.learning_circles;
    if (!circle || !circle.is_active) return null;
    return circle;
  },

  async create(
    supabase: Client,
    values: LearningCircleFormValues,
    createdBy: string
  ): Promise<LearningCircleDetail> {
    const { data, error } = await supabase
      .from("learning_circles")
      .insert({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        lead_admin_id: values.lead_admin_id,
        created_by: createdBy,
      })
      .select("id")
      .single();
    if (error) throw translateCircleError(error);

    const circleId = (data as { id: string }).id;

    if (values.member_ids?.length) {
      await this.setMembers(supabase, circleId, values.member_ids, createdBy);
    }

    return this.getById(supabase, circleId);
  },

  async update(supabase: Client, id: string, values: LearningCircleUpdateValues) {
    const payload = {
      ...(values.name !== undefined ? { name: values.name.trim() } : {}),
      ...(values.description !== undefined ? { description: values.description.trim() || null } : {}),
      ...(values.lead_admin_id !== undefined ? { lead_admin_id: values.lead_admin_id } : {}),
      ...(values.is_active !== undefined ? { is_active: values.is_active } : {}),
    };
    const { error } = await supabase.from("learning_circles").update(payload).eq("id", id);
    if (error) throw translateCircleError(error);
    return this.getById(supabase, id);
  },

  /** Soft delete, mirroring volunteerRepository.deactivate(). */
  async deactivate(supabase: Client, id: string) {
    const { error } = await supabase.from("learning_circles").update({ is_active: false }).eq("id", id);
    if (error) throw error;
  },

  /**
   * Replaces the circle's roster with exactly `volunteerIds`.
   *
   * Declarative rather than incremental: the caller sends the roster it
   * wants and this computes the diff, so a half-applied batch can't leave
   * the UI and the database disagreeing about who is in the circle.
   *
   * Note that removing a volunteer does NOT touch debriefs they already
   * filed — `progress.learning_circle_id` is snapshotted at insert time, so
   * anything already pending stays with the circle (and lead admin) that
   * was responsible when the class happened.
   */
  async setMembers(supabase: Client, circleId: string, volunteerIds: string[], addedBy: string) {
    const { data: existing, error: readError } = await supabase
      .from("learning_circle_members")
      .select("volunteer_id")
      .eq("circle_id", circleId);
    if (readError) throw readError;

    const currentIds = new Set((existing ?? []).map((r) => (r as { volunteer_id: string }).volunteer_id));
    const desiredIds = new Set(volunteerIds);

    const toAdd = [...desiredIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("learning_circle_members")
        .delete()
        .eq("circle_id", circleId)
        .in("volunteer_id", toRemove);
      if (error) throw error;
    }

    if (toAdd.length > 0) {
      const { error } = await supabase.from("learning_circle_members").insert(
        toAdd.map((volunteerId) => ({
          circle_id: circleId,
          volunteer_id: volunteerId,
          added_by: addedBy,
        }))
      );
      if (error) throw translateMembershipError(error);
    }

    return { added: toAdd.length, removed: toRemove.length };
  },

  /**
   * Pending debriefs awaiting verification.
   *
   * `leadAdminId` scopes the queue to circles that admin actually leads —
   * this is the application-layer half of the rule the DB trigger enforces
   * (`guard_debrief_verification`). Passing null returns every pending
   * debrief program-wide, which is what the "all circles" admin view uses
   * for visibility only; the verify action itself still fails at the
   * database for an admin who isn't the lead.
   */
  async listPendingDebriefs(supabase: Client, leadAdminId: string | null): Promise<PendingDebrief[]> {
    let query = supabase
      .from("progress")
      .select(
        `*,
         students(id, name, grade),
         volunteers!progress_volunteer_id_fkey(id, name, preferred_name, avatar_url),
         learning_circles!progress_learning_circle_id_fkey!inner(id, name, lead_admin_id)`
      )
      .eq("verification_status", "pending")
      .order("created_at", { ascending: false });

    if (leadAdminId) {
      query = query.eq("learning_circles.lead_admin_id", leadAdminId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as PendingDebrief[];
  },

  /** How many debriefs are waiting on this admin — for the nav badge. */
  async pendingCountForLead(supabase: Client, leadAdminId: string): Promise<number> {
    const { count, error } = await supabase
      .from("progress")
      .select("id, learning_circles!progress_learning_circle_id_fkey!inner(lead_admin_id)", {
        count: "exact",
        head: true,
      })
      .eq("verification_status", "pending")
      .eq("learning_circles.lead_admin_id", leadAdminId);
    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Records or rejects a debrief.
   *
   * `verified_by` / `verified_at` are deliberately NOT set here — the
   * BEFORE UPDATE trigger stamps them from auth.uid() and now(), so the
   * audit trail reflects who the database actually saw, not what this
   * process claimed. The same trigger rejects the update outright if the
   * caller isn't the circle's lead admin, which is why a 403 is translated
   * out of the driver error below.
   */
  async setVerification(
    supabase: Client,
    debriefId: string,
    action: "verify" | "reject",
    notes?: string
  ) {
    const { data, error } = await supabase
      .from("progress")
      .update({
        verification_status: action === "verify" ? "verified" : "rejected",
        verification_notes: notes?.trim() || null,
      })
      .eq("id", debriefId)
      .eq("verification_status", "pending")
      .select("*")
      .maybeSingle();

    if (error) throw translateVerificationError(error);
    if (!data) {
      // Either the id doesn't exist, or it isn't pending any more — someone
      // else got there first. Both are "nothing to do", not a server fault.
      throw new ApiError(409, "This debrief is no longer awaiting verification.");
    }
    return data;
  },
};

/** Postgres error shape we care about — code plus message. */
type PgError = { code?: string; message?: string };

function translateCircleError(error: unknown): unknown {
  const pg = error as PgError;
  if (pg?.code === "23505") {
    return new ApiError(409, "A Learning Circle with that name already exists.");
  }
  if (pg?.code === "23514" && pg.message?.includes("must be an active admin")) {
    return new ApiError(400, "The lead of a Learning Circle must be an active admin.");
  }
  return error;
}

function translateMembershipError(error: unknown): unknown {
  const pg = error as PgError;
  // learning_circle_members_volunteer_id_key — one circle per volunteer.
  if (pg?.code === "23505") {
    return new ApiError(
      409,
      "One of those volunteers already belongs to another Learning Circle. Remove them from it first."
    );
  }
  return error;
}

function translateVerificationError(error: unknown): unknown {
  const pg = error as PgError;
  if (pg?.code === "42501") {
    return new ApiError(403, pg.message ?? "You are not the lead admin of this Learning Circle.");
  }
  return error;
}

export type { LearningCircle };
