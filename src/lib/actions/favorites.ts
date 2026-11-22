"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/checkout";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Guardar y quitar favoritos.
 *
 * Se escribe con el cliente de sesión, no con la service role: las políticas
 * RLS ya obligan a que `user_id` sea el del propio usuario, así que no hace
 * falta confiar en lo que llegue del navegador. Si alguien manda otro id, la
 * base rechaza la fila.
 */
const schema = z.object({
  target: z.enum(["event", "venue"]),
  id: z.string().uuid("Identificador inválido"),
});

export async function toggleFavoriteAction(
  input: unknown,
): Promise<ActionResult<{ favorite: boolean }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión para guardar favoritos", code: "auth" };

  const column = parsed.data.target === "event" ? "event_id" : "venue_id";

  try {
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", session.user.id)
      .eq(column, parsed.data.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("favorites").delete().eq("id", existing.id as string);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/cuenta/favoritos");
      return { ok: true, favorite: false };
    }

    const { error } = await supabase.from("favorites").insert({
      user_id: session.user.id,
      [column]: parsed.data.id,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/cuenta/favoritos");
    return { ok: true, favorite: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar el favorito",
    };
  }
}
