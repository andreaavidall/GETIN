"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/checkout";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { assertCan } from "@/lib/domain/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Ficha del local: lo que ayuda a decidir.
 *
 * Todo lo de aquí lo escribe el local sobre sí mismo. GETIN no rellena nada:
 * un local sin rampa y un local que no contestó no son lo mismo, así que un
 * campo vacío se queda vacío y la ficha no lo menciona.
 *
 * El permiso se comprueba en el servidor y además lo vuelve a comprobar la
 * política RLS de cada tabla.
 */
async function requireVenue(venueId: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Inicia sesión" };
  try {
    assertCan(session.actor, "venue.manageEvents", venueId);
  } catch {
    return { ok: false as const, error: "No administras este local" };
  }
  return { ok: true as const, userId: session.user.id };
}

const lista = z
  .string()
  .trim()
  .max(400)
  .transform((v) =>
    v
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12),
  );

const perfilSchema = z.object({
  venueId: z.string().uuid(),
  ambiences: lista,
  accessibility: z.string().trim().max(300).optional(),
  parking: z.string().trim().max(300).optional(),
  entranceNotes: z.string().trim().max(300).optional(),
  dressCode: z.string().trim().max(200).optional(),
});

export async function updateVenueProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = perfilSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const auth = await requireVenue(parsed.data.venueId);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("venues")
    .update({
      ambiences: parsed.data.ambiences,
      accessibility: parsed.data.accessibility || null,
      parking: parsed.data.parking || null,
      entrance_notes: parsed.data.entranceNotes || null,
      dress_code: parsed.data.dressCode || null,
    })
    .eq("id", parsed.data.venueId);

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    action: "venue.update",
    entity: "venues",
    entityId: parsed.data.venueId,
    actorId: auth.userId,
    venueId: parsed.data.venueId,
  });

  revalidatePath("/club/dashboard/local");
  return { ok: true };
}

const fotoSchema = z.object({
  venueId: z.string().uuid(),
  url: z.string().url("Pega una dirección de imagen válida").max(600),
  alt: z.string().trim().max(160).optional(),
  kind: z.enum(["ambiente", "mesa", "fachada"]).default("ambiente"),
});

export async function addVenuePhotoAction(input: unknown): Promise<ActionResult> {
  const parsed = fotoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const auth = await requireVenue(parsed.data.venueId);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("venue_images")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", parsed.data.venueId);

  if ((count ?? 0) >= 12) {
    return { ok: false, error: "Máximo 12 fotos por local" };
  }

  const { error } = await supabase.from("venue_images").insert({
    venue_id: parsed.data.venueId,
    url: parsed.data.url,
    alt: parsed.data.alt || null,
    kind: parsed.data.kind,
    position: count ?? 0,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/club/dashboard/local");
  return { ok: true };
}

export async function removeVenuePhotoAction(
  venueId: unknown,
  photoId: unknown,
): Promise<ActionResult> {
  const ids = z
    .object({ venueId: z.string().uuid(), photoId: z.string().uuid() })
    .safeParse({ venueId, photoId });
  if (!ids.success) return { ok: false, error: "Foto inválida" };

  const auth = await requireVenue(ids.data.venueId);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("venue_images").delete().eq("id", ids.data.photoId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/club/dashboard/local");
  return { ok: true };
}

const promoSchema = z.object({
  venueId: z.string().uuid(),
  eventId: z.string().uuid().optional(),
  title: z.string().trim().min(3, "Ponle un título").max(80),
  description: z.string().trim().min(10, "Explica en qué consiste").max(400),
  // Obligatorias a propósito: un beneficio sin letra pequeña visible es lo
  // que acaba en una discusión en la puerta.
  conditions: z
    .string()
    .trim()
    .min(10, "Las condiciones son obligatorias: es lo que evita el malentendido")
    .max(400),
  endsAt: z.string().trim().optional(),
});

export async function createPromotionAction(input: unknown): Promise<ActionResult> {
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const auth = await requireVenue(parsed.data.venueId);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("promotions").insert({
    venue_id: parsed.data.venueId,
    event_id: parsed.data.eventId || null,
    title: parsed.data.title,
    description: parsed.data.description,
    conditions: parsed.data.conditions,
    ends_at: parsed.data.endsAt ? new Date(`${parsed.data.endsAt}T23:59:59-05:00`).toISOString() : null,
  });

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    action: "promotion.create",
    entity: "promotions",
    entityId: parsed.data.title,
    actorId: auth.userId,
    venueId: parsed.data.venueId,
  });

  revalidatePath("/club/dashboard/local");
  return { ok: true };
}

export async function togglePromotionAction(
  venueId: unknown,
  promotionId: unknown,
  active: unknown,
): Promise<ActionResult> {
  const parsed = z
    .object({
      venueId: z.string().uuid(),
      promotionId: z.string().uuid(),
      active: z.boolean(),
    })
    .safeParse({ venueId, promotionId, active });
  if (!parsed.success) return { ok: false, error: "Promoción inválida" };

  const auth = await requireVenue(parsed.data.venueId);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("promotions")
    .update({ is_active: parsed.data.active })
    .eq("id", parsed.data.promotionId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/club/dashboard/local");
  return { ok: true };
}

/**
 * Colocar las mesas en el plano.
 *
 * Se guardan en porcentaje del salón para que el plano escale en cualquier
 * pantalla. La ficha solo dibuja el plano si TODAS las mesas tienen posición:
 * medio plano colocado engaña más que no tener plano.
 */
const posicionSchema = z.object({
  venueId: z.string().uuid(),
  positions: z
    .array(
      z.object({
        id: z.string().uuid(),
        x: z.coerce.number().min(0).max(100),
        y: z.coerce.number().min(0).max(100),
      }),
    )
    .max(80),
  /**
   * Personas cuyo ingreso cubre cada mesa. `null` deja el campo sin declarar,
   * y la ficha lo dice tal cual: "el local no lo ha indicado". Es distinto de
   * declarar 0, que significa que nadie entra con la mesa.
   */
  entries: z
    .array(
      z.object({
        id: z.string().uuid(),
        includesEntryFor: z.coerce.number().int().min(0).max(50).nullable(),
      }),
    )
    .max(80)
    .default([]),
});

export async function updateTablePositionsAction(input: unknown): Promise<ActionResult> {
  const parsed = posicionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Posiciones inválidas" };
  }
  const auth = await requireVenue(parsed.data.venueId);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  for (const pos of parsed.data.positions) {
    const { error } = await supabase
      .from("venue_tables")
      .update({ position_x: pos.x, position_y: pos.y })
      .eq("id", pos.id)
      .eq("venue_id", parsed.data.venueId);
    if (error) return { ok: false, error: error.message };
  }

  for (const entrada of parsed.data.entries) {
    const { error } = await supabase
      .from("venue_tables")
      .update({ includes_entry_for: entrada.includesEntryFor })
      .eq("id", entrada.id)
      .eq("venue_id", parsed.data.venueId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/club/dashboard/local");
  return { ok: true };
}
