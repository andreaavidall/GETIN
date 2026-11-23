"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/checkout";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Soporte atado a la compra.
 *
 * El motivo no es decorativo: "pago pendiente", "no recibí el QR" y "evento
 * cancelado" se resuelven de formas distintas, y pedirlo de entrada evita el
 * primer intercambio de correos. La solicitud queda con estado para que quien
 * reclama vea en qué va, en lugar de mirar su bandeja de salida.
 */
export const SUPPORT_REASONS = {
  pago_pendiente: "Pagué y mi orden sigue pendiente",
  qr_no_recibido: "No recibí mi código QR",
  evento_cancelado: "El evento se canceló o cambió",
  no_pude_entrar: "No pude entrar al local",
  cobro_incorrecto: "Me cobraron de más",
  otro: "Otro problema",
} as const;

const openSchema = z.object({
  orderId: z.string().uuid().optional(),
  reason: z.enum(
    Object.keys(SUPPORT_REASONS) as [keyof typeof SUPPORT_REASONS, ...(keyof typeof SUPPORT_REASONS)[]],
  ),
  body: z.string().trim().min(10, "Cuéntanos qué pasó, con algo de detalle").max(2000),
});

export async function openSupportTicketAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = openSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión", code: "auth" };

  const supabase = await createSupabaseServerClient();

  // La orden tiene que ser suya: la RLS de `orders` ya solo devuelve las
  // propias, así que si no aparece, no es de quien pregunta.
  let venueId: string | null = null;
  if (parsed.data.orderId) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, venue_id")
      .eq("id", parsed.data.orderId)
      .maybeSingle();
    if (!order) return { ok: false, error: "No encontramos esa orden en tu cuenta" };
    venueId = (order.venue_id as string | null) ?? null;
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: session.user.id,
      order_id: parsed.data.orderId ?? null,
      venue_id: venueId,
      reason: parsed.data.reason,
      subject: SUPPORT_REASONS[parsed.data.reason],
      body: parsed.data.body,
      last_reply_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !ticket) {
    return { ok: false, error: error?.message ?? "No se pudo registrar tu solicitud" };
  }

  // El primer mensaje del hilo es el propio texto: así la conversación se lee
  // entera en un sitio.
  await supabase.from("support_messages").insert({
    support_ticket_id: ticket.id as string,
    author_id: session.user.id,
    is_staff: false,
    body: parsed.data.body,
  });

  await recordAudit({
    action: "support.open",
    entity: "support_tickets",
    entityId: ticket.id as string,
    actorId: session.user.id,
    venueId,
    metadata: { reason: parsed.data.reason },
  });

  revalidatePath("/cuenta/soporte");
  return { ok: true, id: ticket.id as string };
}

const replySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(2, "Escribe tu mensaje").max(2000),
});

export async function replySupportAction(input: unknown): Promise<ActionResult> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("support_messages").insert({
    support_ticket_id: parsed.data.ticketId,
    author_id: session.user.id,
    is_staff: false,
    body: parsed.data.body,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/cuenta/soporte");
  return { ok: true };
}
