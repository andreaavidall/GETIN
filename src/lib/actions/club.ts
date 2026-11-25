"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/domain/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { limaTimestamp, slugify } from "@/lib/utils";
import {
  eventFormSchema,
  ticketTypeFormSchema,
  venueApplicationSchema,
} from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/actions/checkout";

/**
 * Acciones del panel de discotecas.
 *
 * Todas comprueban el permiso en el SERVIDOR con `can(actor, acción, venueId)`,
 * y escriben con el cliente sujeto a RLS: si el guard se equivocara, la base
 * también niega. Un administrador de un local no puede tocar otro.
 */

async function requireVenuePermission(
  venueId: string,
  action: Parameters<typeof can>[1],
): Promise<
  | { ok: true; userId: string; role: "client" | "club_admin" | "door_staff" | "superadmin" }
  | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Necesitas iniciar sesión" };
  if (!can(session.actor, action, venueId)) {
    return { ok: false, error: "No tienes permiso sobre este local" };
  }
  return { ok: true, userId: session.user.id, role: session.user.role };
}

/**
 * Las fechas de los formularios del local son HORA DE LIMA.
 *
 * Antes esto hacia `new Date(value)` a secas y el valor de un
 * `<input type="datetime-local">` no lleva zona: lo interpretaba la zona de
 * quien ejecutaba el codigo. En Vercel eso es UTC, asi que las 22:00 que
 * escribia el local se guardaban como las 17:00 de Lima.
 */
const toTimestamp = limaTimestamp;

// ----------------------------------------------------------------- eventos ---

export async function createEventAction(
  venueId: string,
  input: unknown,
): Promise<ActionResult<{ eventId: string; slug: string }>> {
  const auth = await requireVenuePermission(venueId, "venue.manageEvents");
  if (!auth.ok) return auth;

  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  // Slug único: nombre + sufijo corto para no chocar con otro evento.
  const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: created, error } = await supabase
    .from("events")
    .insert({
      venue_id: venueId,
      slug,
      name: data.name,
      tagline: data.tagline || null,
      description: data.description || null,
      cover_url: data.coverUrl || null,
      starts_at: toTimestamp(data.startsAt),
      ends_at: toTimestamp(data.endsAt),
      last_entry_at: toTimestamp(data.lastEntryAt),
      min_age: data.minAge,
      music_genres: data.musicGenres,
      entry_rules: data.entryRules || null,
      cancellation_policy: data.cancellationPolicy,
      // Nace en borrador: publicar es un paso aparte y consciente.
      status: "draft",
      created_by: auth.userId,
    })
    .select("id, slug")
    .single();

  if (error || !created) {
    return { ok: false, error: `No se pudo crear el evento: ${error?.message}` };
  }

  await recordAudit({
    action: "event.create",
    entity: "events",
    entityId: created.id as string,
    actorId: auth.userId,
    actorRole: auth.role,
    venueId,
    metadata: { name: data.name },
  });

  revalidatePath("/club/dashboard");
  return { ok: true, eventId: created.id as string, slug: created.slug as string };
}

export async function publishEventAction(
  venueId: string,
  eventId: string,
  publish: boolean,
): Promise<ActionResult> {
  const auth = await requireVenuePermission(venueId, "venue.manageEvents");
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();

  if (publish) {
    // No se publica un evento sin entradas configuradas: seria una página que
    // no se puede comprar.
    const { count } = await supabase
      .from("ticket_types")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("is_active", true);

    if ((count ?? 0) === 0) {
      return {
        ok: false,
        error: "Configura al menos un tipo de entrada activo antes de publicar el evento",
      };
    }
  }

  const { error } = await supabase
    .from("events")
    .update({
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", eventId)
    .eq("venue_id", venueId);

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    action: "event.publish",
    entity: "events",
    entityId: eventId,
    actorId: auth.userId,
    actorRole: auth.role,
    venueId,
    metadata: { published: publish },
  });

  revalidatePath("/club/dashboard");
  revalidatePath("/eventos");
  return { ok: true };
}

// ---------------------------------------------------------------- entradas ---

export async function createTicketTypeAction(
  venueId: string,
  eventId: string,
  input: unknown,
): Promise<ActionResult<{ ticketTypeId: string }>> {
  const auth = await requireVenuePermission(venueId, "venue.manageTickets");
  if (!auth.ok) return auth;

  const parsed = ticketTypeFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: created, error } = await supabase
    .from("ticket_types")
    .insert({
      event_id: eventId,
      name: data.name,
      description: data.description || null,
      // Soles -> centimos. El redondeo se hace una sola vez, aquí.
      price_cents: Math.round(data.price * 100),
      capacity: data.capacity,
      max_per_order: data.maxPerOrder,
      sales_start_at: toTimestamp(data.salesStartAt),
      sales_end_at: toTimestamp(data.salesEndAt),
      conditions: data.conditions || null,
      is_active: data.isActive,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { ok: false, error: `No se pudo crear la entrada: ${error?.message}` };
  }

  await recordAudit({
    action: "ticketType.create",
    entity: "ticket_types",
    entityId: created.id as string,
    actorId: auth.userId,
    actorRole: auth.role,
    venueId,
    metadata: { event_id: eventId, price_cents: Math.round(data.price * 100) },
  });

  revalidatePath("/club/dashboard");
  return { ok: true, ticketTypeId: created.id as string };
}

/**
 * Cambia el aforo o activa/desactiva un tipo de entrada.
 * No puede bajar el aforo por debajo de lo ya vendido o retenido: el trigger
 * `ticket_types_guard` lo rechaza, y aquí se traduce a un mensaje claro.
 */
export async function updateTicketTypeAction(
  venueId: string,
  ticketTypeId: string,
  changes: { capacity?: number; isActive?: boolean },
): Promise<ActionResult> {
  const auth = await requireVenuePermission(venueId, "venue.manageTickets");
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const payload: Record<string, unknown> = {};
  if (typeof changes.capacity === "number") payload.capacity = changes.capacity;
  if (typeof changes.isActive === "boolean") payload.is_active = changes.isActive;
  if (Object.keys(payload).length === 0) return { ok: true };

  const { error } = await supabase.from("ticket_types").update(payload).eq("id", ticketTypeId);

  if (error) {
    return {
      ok: false,
      error: error.message.includes("CAPACITY_BELOW_SOLD")
        ? "No puedes reducir el aforo por debajo de las entradas ya vendidas o retenidas"
        : error.message,
    };
  }

  await recordAudit({
    action: "ticketType.update",
    entity: "ticket_types",
    entityId: ticketTypeId,
    actorId: auth.userId,
    actorRole: auth.role,
    venueId,
    metadata: changes,
  });

  revalidatePath("/club/dashboard");
  return { ok: true };
}

// ------------------------------------------------------- solicitud de local ---

/**
 * Solicitud para publicar un local. Queda en `draft` + expediente
 * `pending_review`: la publicación la aprueba GETIN, nunca el propio local
 * (lo refuerzan los triggers `venues_guard_insert` y `venues_guard`).
 */
export async function applyAsVenueAction(
  input: unknown,
): Promise<ActionResult<{ venueId: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Necesitas iniciar sesión" };

  const parsed = venueApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const data = parsed.data;

  const supabase = await createSupabaseServerClient();
  const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 5)}`;

  const { data: venue, error } = await supabase
    .from("venues")
    .insert({
      slug,
      name: data.name,
      legal_name: data.legalName,
      tax_id: data.taxId,
      district: data.district,
      address: data.address,
      phone: data.phone,
      email: data.email,
      capacity: data.capacity,
      min_age: data.minAge,
      description: data.description || null,
      music_genres: data.musicGenres,
      owner_id: session.user.id,
    })
    .select("id")
    .single();

  if (error || !venue) {
    return { ok: false, error: `No se pudo registrar el local: ${error?.message}` };
  }

  const venueId = venue.id as string;

  // El dueño se convierte en staff 'owner' para poder gestionarlo.
  await supabase.from("venue_staff").insert({
    venue_id: venueId,
    user_id: session.user.id,
    role: "owner",
  });

  await supabase.from("venue_verifications").insert({
    venue_id: venueId,
    submitted_by: session.user.id,
    notes: "Solicitud enviada desde la web.",
  });

  await recordAudit({
    action: "venue.create",
    entity: "venues",
    entityId: venueId,
    actorId: session.user.id,
    actorRole: session.user.role,
    venueId,
    metadata: { name: data.name, tax_id: data.taxId },
  });

  revalidatePath("/club/dashboard");
  return { ok: true, venueId };
}

// ------------------------------------------------------------------ listas ---

export async function decideGuestEntryAction(
  venueId: string,
  entryId: string,
  approve: boolean,
  note?: string,
): Promise<ActionResult> {
  const auth = await requireVenuePermission(venueId, "venue.manageGuestLists");
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("getin_decide_guest_entry", {
    p_entry_id: entryId,
    p_approve: approve,
    p_note: note ?? null,
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("LIST_FULL")
        ? "La lista ya alcanzo su cupo"
        : error.message,
    };
  }

  await recordAudit({
    action: "guestEntry.decide",
    entity: "guest_list_entries",
    entityId: entryId,
    actorId: auth.userId,
    actorRole: auth.role,
    venueId,
    metadata: { approve },
  });

  revalidatePath("/club/dashboard");
  return { ok: true };
}
