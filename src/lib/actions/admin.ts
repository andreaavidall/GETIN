"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { isSuperadmin } from "@/lib/domain/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/checkout";

/**
 * Acciones del panel GETIN (superadministrador).
 *
 * Cada una verifica el rol en el servidor y queda registrada en `audit_logs`:
 * aprobar un local, cambiar una comision o suspender una cuenta son decisiones
 * que deben poder reconstruirse despues.
 */
async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Necesitas iniciar sesion" };
  if (!isSuperadmin(session.actor)) return { ok: false, error: "Solo el equipo GETIN puede hacer esto" };
  return { ok: true, userId: session.user.id };
}

export async function decideVenueAction(
  venueId: string,
  decision: "approve" | "reject" | "suspend",
  notes?: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();

  const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "suspended";

  const { error } = await supabase
    .from("venues")
    .update({
      status,
      is_verified: decision === "approve",
      published_at: decision === "approve" ? new Date().toISOString() : null,
    })
    .eq("id", venueId);

  if (error) return { ok: false, error: error.message };

  await supabase
    .from("venue_verifications")
    .update({
      status,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes ?? null,
    })
    .eq("venue_id", venueId)
    .eq("status", "pending_review");

  await recordAudit({
    action:
      decision === "approve" ? "venue.approve" : decision === "reject" ? "venue.reject" : "venue.suspend",
    entity: "venues",
    entityId: venueId,
    actorId: auth.userId,
    actorRole: "superadmin",
    venueId,
    metadata: { notes: notes ?? null },
  });

  revalidatePath("/admin");
  revalidatePath("/discotecas");
  return { ok: true };
}

const commissionSchema = z.object({
  /** Comision en porcentaje, p. ej. 7.5 */
  percent: z.coerce.number().min(0).max(100),
});

export async function setDefaultCommissionAction(input: unknown): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = commissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Porcentaje invalido" };

  const bps = Math.round(parsed.data.percent * 100);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ default_commission_bps: bps, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    action: "commission.update",
    entity: "platform_settings",
    entityId: "1",
    actorId: auth.userId,
    actorRole: "superadmin",
    metadata: { default_commission_bps: bps },
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function setVenueCommissionAction(
  venueId: string,
  percent: number | null,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const bps = percent === null ? null : Math.round(percent * 100);
  if (bps !== null && (bps < 0 || bps > 10000)) {
    return { ok: false, error: "Porcentaje invalido" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("venues").update({ commission_bps: bps }).eq("id", venueId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    action: "commission.update",
    entity: "venues",
    entityId: venueId,
    actorId: auth.userId,
    actorRole: "superadmin",
    venueId,
    metadata: { commission_bps: bps },
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function suspendUserAction(
  userId: string,
  suspend: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (userId === auth.userId) {
    return { ok: false, error: "No puedes suspender tu propia cuenta" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ is_suspended: suspend }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    action: "user.suspend",
    entity: "profiles",
    entityId: userId,
    actorId: auth.userId,
    actorRole: "superadmin",
    metadata: { suspended: suspend },
  });

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Decide un reembolso ya solicitado.
 *
 * No mueve dinero por si solo: deja el registro en estado `approved` y anula las
 * entradas. La devolucion efectiva la ejecuta el adaptador del proveedor, y por
 * eso queda explicito en el mensaje al operador.
 */
export async function decideRefundAction(
  refundId: string,
  approve: boolean,
  notes?: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: refund, error: readError } = await supabase
    .from("refunds")
    .select("id, order_id, amount_cents, status")
    .eq("id", refundId)
    .maybeSingle();

  if (readError || !refund) return { ok: false, error: "Solicitud no encontrada" };
  if (refund.status !== "requested") {
    return { ok: false, error: `Esta solicitud ya esta en estado ${refund.status}` };
  }

  const { error } = await supabase
    .from("refunds")
    .update({
      status: approve ? "approved" : "rejected",
      decided_by: auth.userId,
      decided_at: new Date().toISOString(),
      reason: notes ? `${notes}` : undefined,
    })
    .eq("id", refundId);

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    action: "refund.decide",
    entity: "refunds",
    entityId: refundId,
    actorId: auth.userId,
    actorRole: "superadmin",
    metadata: { approve, amount_cents: refund.amount_cents },
  });

  revalidatePath("/admin");
  return { ok: true };
}
