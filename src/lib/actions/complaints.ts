"use server";

import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { complaintSchema } from "@/lib/validation/schemas";

/**
 * Registro en el Libro de Reclamaciones.
 *
 * Se escribe con la service role a propósito: el correlativo y la fecha límite
 * los pone la base, no el navegador. Quien reclama no necesita tener cuenta
 * —la norma no lo exige— pero si la tiene, la reclamación queda asociada para
 * que pueda consultarla.
 */
export type ComplaintResult =
  | {
      ok: true;
      correlative: string;
      dueAt: string;
      kind: "reclamo" | "queja";
      email: string;
    }
  | { ok: false; error: string };

export async function submitComplaintAction(input: unknown): Promise<ComplaintResult> {
  const parsed = complaintSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos" };
  }
  const d = parsed.data;

  try {
    const session = await getSession();
    const admin = createSupabaseAdminClient();

    // Si indicó un código de orden, se intenta enlazar para tener el contexto.
    let orderId: string | null = null;
    let venueId: string | null = null;
    if (d.orderCode) {
      const { data: order } = await admin
        .from("orders")
        .select("id, venue_id")
        .eq("code", d.orderCode.trim().toUpperCase())
        .maybeSingle();
      orderId = (order?.id as string | undefined) ?? null;
      venueId = (order?.venue_id as string | undefined) ?? null;
    }

    const { data, error } = await admin
      .from("complaints")
      .insert({
        kind: d.kind,
        good_type: d.goodType,
        full_name: d.fullName,
        document_type: d.documentType,
        document_number: d.documentNumber,
        email: d.email,
        phone: d.phone || null,
        address: d.address || null,
        is_minor: d.isMinor,
        guardian_name: d.guardianName || null,
        order_code: d.orderCode || null,
        order_id: orderId,
        venue_id: venueId,
        amount_cents:
          typeof d.amount === "number" && d.amount > 0 ? Math.round(d.amount * 100) : null,
        good_description: d.goodDescription,
        detail: d.detail,
        request: d.request,
        user_id: session?.user.id ?? null,
      })
      .select("correlative, due_at, kind, email")
      .single();

    if (error || !data) {
      return { ok: false, error: `No se pudo registrar: ${error?.message ?? "error desconocido"}` };
    }

    await recordAudit({
      action: "complaint.create",
      entity: "complaints",
      entityId: data.correlative as string,
      actorId: session?.user.id ?? null,
      venueId,
      metadata: { kind: d.kind, order_code: d.orderCode || null },
    });

    return {
      ok: true,
      correlative: data.correlative as string,
      dueAt: data.due_at as string,
      kind: data.kind as "reclamo" | "queja",
      email: data.email as string,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo registrar la reclamación. Inténtalo de nuevo.",
    };
  }
}
