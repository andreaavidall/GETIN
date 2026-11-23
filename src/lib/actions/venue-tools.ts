"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/checkout";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { assertCan } from "@/lib/domain/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

/**
 * Herramientas para que un local no empiece de cero cada semana.
 *
 * La fiesta de los sábados es la misma configuración una y otra vez: mismos
 * tipos de entrada, mismas mesas, mismas listas. Duplicar un evento convierte
 * media hora de formulario en dos clics, y es lo que hace que el catálogo
 * siga actualizado.
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

const duplicateSchema = z.object({
  venueId: z.string().uuid(),
  eventId: z.string().uuid(),
  /** Fecha de la copia, en hora de Lima (YYYY-MM-DD). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
  copyTables: z.boolean().default(true),
  copyGuestLists: z.boolean().default(true),
});

export async function duplicateEventAction(
  input: unknown,
): Promise<ActionResult<{ eventId: string; slug: string }>> {
  const parsed = duplicateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const auth = await requireVenue(parsed.data.venueId);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();

  const { data: original } = await supabase
    .from("events")
    .select("*")
    .eq("id", parsed.data.eventId)
    .eq("venue_id", parsed.data.venueId)
    .maybeSingle();

  if (!original) return { ok: false, error: "No encontramos ese evento" };

  // Se conserva la HORA del original y se cambia el día. Una fiesta que
  // empieza a las 23:00 tiene que seguir empezando a las 23:00 en la copia,
  // y en hora de Lima, no en la del servidor.
  const inicioOriginal = new Date(original.starts_at as string);
  const horaLima = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(inicioOriginal);

  const nuevoInicio = new Date(`${parsed.data.date}T${horaLima}:00-05:00`);
  const desplazamiento = nuevoInicio.getTime() - inicioOriginal.getTime();

  const mover = (valor: string | null): string | null =>
    valor === null ? null : new Date(new Date(valor).getTime() + desplazamiento).toISOString();

  const slug = `${slugify(original.name as string)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: copia, error } = await supabase
    .from("events")
    .insert({
      venue_id: parsed.data.venueId,
      slug,
      name: original.name,
      tagline: original.tagline,
      description: original.description,
      cover_url: original.cover_url,
      starts_at: nuevoInicio.toISOString(),
      ends_at: mover(original.ends_at as string | null),
      doors_open_at: mover(original.doors_open_at as string | null),
      last_entry_at: mover(original.last_entry_at as string | null),
      min_age: original.min_age,
      music_genres: original.music_genres,
      lineup: original.lineup,
      entry_rules: original.entry_rules,
      cancellation_policy: original.cancellation_policy,
      // La copia nace en borrador SIEMPRE: duplicar no es publicar.
      status: "draft",
      created_by: auth.userId,
    })
    .select("id, slug")
    .single();

  if (error || !copia) return { ok: false, error: error?.message ?? "No se pudo duplicar" };
  const nuevoId = copia.id as string;

  // Tipos de entrada: se copia la configuración, nunca los contadores.
  const { data: tipos } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("event_id", parsed.data.eventId);

  for (const tipo of tipos ?? []) {
    await supabase.from("ticket_types").insert({
      event_id: nuevoId,
      name: tipo.name,
      description: tipo.description,
      price_cents: tipo.price_cents,
      capacity: tipo.capacity,
      max_per_order: tipo.max_per_order,
      sales_start_at: mover(tipo.sales_start_at as string | null),
      sales_end_at: mover(tipo.sales_end_at as string | null),
      conditions: tipo.conditions,
      includes: tipo.includes,
      position: tipo.position,
      is_active: tipo.is_active,
      // sold_count y held_count se quedan en cero: son de la otra noche.
    });
  }

  if (parsed.data.copyTables) {
    const { data: mesas } = await supabase
      .from("event_table_availability")
      .select("venue_table_id, price_cents, min_consumption_cents, deposit_cents, conditions")
      .eq("event_id", parsed.data.eventId);

    for (const mesa of mesas ?? []) {
      await supabase.from("event_table_availability").insert({
        event_id: nuevoId,
        venue_table_id: mesa.venue_table_id,
        price_cents: mesa.price_cents,
        min_consumption_cents: mesa.min_consumption_cents,
        deposit_cents: mesa.deposit_cents,
        conditions: mesa.conditions,
        state: "available",
      });
    }
  }

  if (parsed.data.copyGuestLists) {
    const { data: listas } = await supabase
      .from("guest_lists")
      .select("name, description, capacity, signup_deadline, last_entry_at, conditions, benefits, auto_approve")
      .eq("event_id", parsed.data.eventId);

    for (const lista of listas ?? []) {
      await supabase.from("guest_lists").insert({
        event_id: nuevoId,
        name: lista.name,
        description: lista.description,
        capacity: lista.capacity,
        signup_deadline: mover(lista.signup_deadline as string | null),
        last_entry_at: mover(lista.last_entry_at as string | null),
        conditions: lista.conditions,
        benefits: lista.benefits,
        auto_approve: lista.auto_approve,
        // confirmed_count arranca en cero.
      });
    }
  }

  await recordAudit({
    action: "event.create",
    entity: "events",
    entityId: nuevoId,
    actorId: auth.userId,
    venueId: parsed.data.venueId,
    metadata: { duplicatedFrom: parsed.data.eventId },
  });

  revalidatePath("/club/dashboard");
  return { ok: true, eventId: nuevoId, slug: copia.slug as string };
}

const scheduleSchema = z.object({
  venueId: z.string().uuid(),
  eventId: z.string().uuid(),
  /** Vacío = quitar la programación. */
  publishAt: z.string().optional(),
});

/**
 * Programar la publicación.
 *
 * Guarda el momento; quien publica de verdad es `getin_publish_scheduled()`,
 * que corre en el servidor. Mientras nadie la ejecute, el evento sigue en
 * borrador: la pantalla lo dice en vez de dar por hecho que saldrá solo.
 */
export async function scheduleEventAction(input: unknown): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const auth = await requireVenue(parsed.data.venueId);
  if (!auth.ok) return auth;

  let publishAt: string | null = null;
  if (parsed.data.publishAt) {
    const fecha = new Date(`${parsed.data.publishAt}:00-05:00`);
    if (Number.isNaN(fecha.getTime())) return { ok: false, error: "Fecha inválida" };
    if (fecha.getTime() < Date.now()) {
      return { ok: false, error: "Esa fecha ya pasó. Publícalo directamente." };
    }
    publishAt = fecha.toISOString();
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("events")
    .update({ publish_at: publishAt })
    .eq("id", parsed.data.eventId)
    .eq("venue_id", parsed.data.venueId)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/club/dashboard");
  return { ok: true };
}
