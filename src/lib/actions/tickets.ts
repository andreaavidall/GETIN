"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/checkout";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { createQrCredential } from "@/lib/domain/qr";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Entradas a nombre de quien va a usarlas, y traspaso controlado.
 *
 * Quien compra para su grupo necesita dos cosas distintas:
 *  · poner el nombre de cada acompañante en su entrada, y
 *  · pasarle la entrada de verdad, para que la lleve en SU teléfono.
 *
 * Lo segundo es delicado: si el QR viejo siguiera valiendo, la misma entrada
 * circularía en dos teléfonos y quien llegara segundo se quedaría fuera. Por
 * eso al reclamarla se anula la credencial anterior y se emite otra. El
 * enlace de traspaso tiene 128 bits, caduca y se guarda solo su hash.
 */
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comprueba que la entrada es de quien dice y que todavía sirve. */
async function requireOwnTicket(ticketId: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Inicia sesión" };

  const admin = createSupabaseAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, user_id, status, event_id, order_id, orders!inner (status), events!inner (starts_at, slug)")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) return { ok: false as const, error: "Entrada no encontrada" };
  if (ticket.user_id !== session.user.id) {
    return { ok: false as const, error: "Esta entrada no es tuya" };
  }
  if (ticket.status !== "issued") {
    return { ok: false as const, error: "Esta entrada ya no se puede modificar" };
  }

  const orders = ticket.orders as unknown as { status: string } | { status: string }[];
  const estadoOrden = Array.isArray(orders) ? orders[0]?.status : orders?.status;
  if (estadoOrden !== "paid") {
    return { ok: false as const, error: "El pago de esta entrada todavía no está confirmado" };
  }

  return { ok: true as const, session, admin, ticket };
}

const renameSchema = z.object({
  ticketId: z.string().uuid(),
  holderName: z.string().trim().min(2, "Escribe el nombre").max(80),
});

export async function setTicketHolderAction(input: unknown): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const check = await requireOwnTicket(parsed.data.ticketId);
  if (!check.ok) return check;

  const { error } = await check.admin
    .from("tickets")
    .update({ holder_name: parsed.data.holderName })
    .eq("id", parsed.data.ticketId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/cuenta/entradas");
  return { ok: true };
}

const transferSchema = z.object({
  ticketId: z.string().uuid(),
  toEmail: z.string().trim().email("Escribe un correo válido").max(160),
});

export async function createTicketTransferAction(
  input: unknown,
): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const check = await requireOwnTicket(parsed.data.ticketId);
  if (!check.ok) return check;

  if (parsed.data.toEmail.toLowerCase() === check.session.user.email.toLowerCase()) {
    return { ok: false, error: "Esa entrada ya es tuya" };
  }

  // Un traspaso abierto por entrada: dos enlaces vivos a la vez es la receta
  // para que dos personas crean que la tienen.
  const { data: abierto } = await check.admin
    .from("ticket_transfers")
    .select("id")
    .eq("ticket_id", parsed.data.ticketId)
    .is("claimed_at", null)
    .is("cancelled_at", null)
    .maybeSingle();

  if (abierto) {
    return { ok: false, error: "Ya hay un traspaso pendiente para esta entrada. Cancélalo primero." };
  }

  const token = randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const { error } = await check.admin.from("ticket_transfers").insert({
    ticket_id: parsed.data.ticketId,
    from_user_id: check.session.user.id,
    to_email: parsed.data.toEmail,
    token_hash: hash(token),
    expires_at: expiresAt,
  });

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    action: "ticket.transfer",
    entity: "tickets",
    entityId: parsed.data.ticketId,
    actorId: check.session.user.id,
    metadata: { step: "created" },
  });

  revalidatePath("/cuenta/entradas");
  return {
    ok: true,
    url: `/entradas/recibir/${token}`,
    expiresAt,
  };
}

export async function cancelTicketTransferAction(transferId: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(transferId);
  if (!parsed.success) return { ok: false, error: "Traspaso inválido" };

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("ticket_transfers")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("from_user_id", session.user.id)
    .is("claimed_at", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cuenta/entradas");
  return { ok: true };
}

/**
 * Reclamar una entrada traspasada.
 *
 * Orden deliberado: primero se anula el QR viejo y solo después se emite el
 * nuevo. Si algo falla en medio, el peor caso es una entrada sin QR —que se
 * arregla desde soporte— y nunca dos QR válidos para el mismo asiento.
 */
export async function claimTicketTransferAction(
  token: unknown,
): Promise<ActionResult<{ eventSlug: string }>> {
  const parsed = z.string().min(10).max(64).safeParse(token);
  if (!parsed.success) return { ok: false, error: "Enlace inválido" };

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión para recibir la entrada", code: "auth" };

  const admin = createSupabaseAdminClient();
  const { data: transfer } = await admin
    .from("ticket_transfers")
    .select("id, ticket_id, from_user_id, expires_at, claimed_at, cancelled_at")
    .eq("token_hash", hash(parsed.data))
    .maybeSingle();

  if (!transfer) return { ok: false, error: "Este enlace no es válido" };
  if (transfer.claimed_at) return { ok: false, error: "Esta entrada ya fue reclamada" };
  if (transfer.cancelled_at) return { ok: false, error: "Quien te la pasó canceló el traspaso" };
  if (new Date(transfer.expires_at as string) < new Date()) {
    return { ok: false, error: "El enlace caducó. Pide uno nuevo." };
  }
  if (transfer.from_user_id === session.user.id) {
    return { ok: false, error: "No puedes reclamar tu propia entrada" };
  }

  const { data: ticket } = await admin
    .from("tickets")
    .select("id, status, event_id, events!inner (slug)")
    .eq("id", transfer.ticket_id as string)
    .maybeSingle();

  if (!ticket || ticket.status !== "issued") {
    return { ok: false, error: "Esta entrada ya no se puede traspasar" };
  }

  // 1. Anular las credenciales vivas: el teléfono anterior deja de servir.
  await admin
    .from("qr_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("ticket_id", ticket.id as string)
    .is("revoked_at", null);

  // 2. La entrada cambia de dueño.
  const { error: errTicket } = await admin
    .from("tickets")
    .update({
      user_id: session.user.id,
      holder_name: session.user.fullName ?? session.user.email,
    })
    .eq("id", ticket.id as string);

  if (errTicket) return { ok: false, error: errTicket.message };

  // 3. QR nuevo para el nuevo dueño.
  const credential = createQrCredential("ticket", ticket.id as string, serverEnv().QR_TOKEN_SECRET);
  const { data: evento } = await admin
    .from("events")
    .select("last_entry_at, ends_at, starts_at")
    .eq("id", ticket.event_id as string)
    .maybeSingle();

  const validUntil =
    (evento?.last_entry_at as string | null) ??
    (evento?.ends_at as string | null) ??
    new Date(new Date(evento?.starts_at as string).getTime() + 12 * 3_600_000).toISOString();

  const { error: errCred } = await admin.from("qr_credentials").insert({
    ticket_id: ticket.id as string,
    nonce: credential.nonce,
    token_hash: credential.tokenHash,
    token_prefix: credential.tokenPrefix,
    event_id: ticket.event_id as string,
    valid_until: validUntil,
  });

  if (errCred) return { ok: false, error: errCred.message };

  await admin
    .from("ticket_transfers")
    .update({ claimed_at: new Date().toISOString(), to_user_id: session.user.id })
    .eq("id", transfer.id as string);

  await recordAudit({
    action: "ticket.transfer",
    entity: "tickets",
    entityId: ticket.id as string,
    actorId: session.user.id,
    metadata: { step: "claimed", from: transfer.from_user_id },
  });

  const events = ticket.events as unknown as { slug: string } | { slug: string }[];
  const slug = Array.isArray(events) ? (events[0]?.slug ?? "") : (events?.slug ?? "");

  revalidatePath("/cuenta/entradas");
  return { ok: true, eventSlug: slug };
}
