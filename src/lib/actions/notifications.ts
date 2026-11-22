"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/checkout";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Avisos: marcar leído y elegir si se quieren.
 *
 * La política de la base solo deja actualizar `read_at`, así que ni siquiera
 * manipulando la petición se puede reescribir el texto de un aviso.
 */
export async function markNotificationReadAction(id: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Aviso inválido" };

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cuenta/avisos");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cuenta/avisos");
  return { ok: true };
}

export async function setNotifyPreferenceAction(enabled: unknown): Promise<ActionResult> {
  const parsed = z.boolean().safeParse(enabled);
  if (!parsed.success) return { ok: false, error: "Valor inválido" };

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ notify_new_events: parsed.data })
    .eq("id", session.user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cuenta/avisos");
  return { ok: true };
}
