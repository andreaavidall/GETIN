import "server-only";

import { headers } from "next/headers";

import type { AppRole } from "@/lib/domain/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Registro de auditoria de operaciones sensibles.
 *
 * Se escribe con la service role porque `audit_logs` no acepta escrituras del
 * cliente: una bitacora que el propio actor puede borrar no sirve de nada.
 *
 * Nunca falla hacia arriba: si la auditoria no se puede escribir, se avisa por
 * consola pero no se rompe la operación del usuario.
 */
export type AuditAction =
  | "auth.signup"
  | "auth.signin"
  | "auth.signout"
  | "complaint.create"
  | "complaint.respond"
  | "order.create"
  | "order.cancel"
  | "payment.intent"
  | "payment.confirm"
  | "payment.failed"
  | "payment.webhook_rejected"
  | "ticket.issue"
  | "ticket.scan"
  | "refund.request"
  | "refund.decide"
  | "venue.create"
  | "venue.approve"
  | "venue.reject"
  | "venue.suspend"
  | "event.create"
  | "event.update"
  | "event.publish"
  | "ticketType.create"
  | "ticketType.update"
  | "staff.invite"
  | "staff.remove"
  | "guestEntry.decide"
  | "commission.update"
  | "user.suspend";

export async function recordAudit(input: {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  actorId?: string | null;
  actorRole?: AppRole | null;
  venueId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const h = await headers();
    const admin = createSupabaseAdminClient();
    await admin.from("audit_logs").insert({
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      actor_id: input.actorId ?? null,
      actor_role: input.actorRole ?? null,
      venue_id: input.venueId ?? null,
      metadata: input.metadata ?? {},
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: h.get("user-agent"),
    });
  } catch (error) {
    console.error("[audit] no se pudo registrar", input.action, error);
  }
}
