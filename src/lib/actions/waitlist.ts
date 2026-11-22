"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/checkout";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Lista de espera.
 *
 * Apuntarse NO reserva nada ni da preferencia: solo pide un aviso si vuelve a
 * haber sitio. Eso se dice en el botón y se repite en el aviso, porque la
 * alternativa —dejar creer que hay algo guardado— se descubre en la puerta.
 */
const schema = z.object({
  eventId: z.string().uuid(),
  ticketTypeId: z.string().uuid().optional(),
  venueTableId: z.string().uuid().optional(),
});

export async function toggleWaitlistAction(
  input: unknown,
): Promise<ActionResult<{ waiting: boolean }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const { eventId, ticketTypeId, venueTableId } = parsed.data;
  if (Boolean(ticketTypeId) === Boolean(venueTableId)) {
    return { ok: false, error: "Elige una entrada o una mesa, no ambas" };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión para que podamos avisarte", code: "auth" };

  try {
    const supabase = await createSupabaseServerClient();
    const column = ticketTypeId ? "ticket_type_id" : "venue_table_id";
    const value = ticketTypeId ?? venueTableId!;

    const { data: existing } = await supabase
      .from("waitlist_entries")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("event_id", eventId)
      .eq(column, value)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("waitlist_entries")
        .delete()
        .eq("id", existing.id as string);
      if (error) return { ok: false, error: error.message };
      return { ok: true, waiting: false };
    }

    const { error } = await supabase.from("waitlist_entries").insert({
      user_id: session.user.id,
      event_id: eventId,
      [column]: value,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/cuenta/avisos");
    return { ok: true, waiting: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo apuntar a la lista de espera",
    };
  }
}
