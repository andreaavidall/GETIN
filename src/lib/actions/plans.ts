"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/checkout";
import { getSession } from "@/lib/auth/session";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Planes de grupo.
 *
 * Un enlace para ponerse de acuerdo: qué evento, quién va y cuántos faltan
 * para completar una mesa. No mueve dinero y no reserva nada; cada quien
 * compra su entrada. Dividir pagos es otra cosa y no se insinúa aquí.
 *
 * El token del enlace ES la credencial de lectura, así que:
 *  · tiene 128 bits de aleatoriedad,
 *  · la página se lee en el servidor (no hay política RLS que lo exponga),
 *  · y quien entra solo ve nombres y respuestas, nunca correos.
 */
const createSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().trim().min(3, "Ponle un nombre al plan").max(80),
  note: z.string().trim().max(280).optional(),
  goalPeople: z.coerce.number().int().min(2).max(50).optional(),
  displayName: z.string().trim().min(2, "¿Con qué nombre te apuntas?").max(60),
});

export async function createPlanAction(
  input: unknown,
): Promise<ActionResult<{ token: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión para crear un plan", code: "auth" };

  try {
    const supabase = await createSupabaseServerClient();
    const token = randomBytes(16).toString("base64url");

    const { data: plan, error } = await supabase
      .from("plans")
      .insert({
        token,
        event_id: parsed.data.eventId,
        creator_id: session.user.id,
        title: parsed.data.title,
        note: parsed.data.note || null,
        goal_people: parsed.data.goalPeople ?? null,
      })
      .select("id, token")
      .single();

    if (error || !plan) return { ok: false, error: error?.message ?? "No se pudo crear el plan" };

    // Quien crea el plan va en él: si no, el contador empieza en cero y no
    // cuadra con la realidad.
    await supabase.from("plan_members").insert({
      plan_id: plan.id as string,
      user_id: session.user.id,
      display_name: parsed.data.displayName,
      rsvp: "va",
    });

    revalidatePath("/cuenta/planes");
    return { ok: true, token: plan.token as string };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear el plan",
    };
  }
}

const rsvpSchema = z.object({
  token: z.string().min(10).max(64),
  displayName: z.string().trim().min(2, "Escribe tu nombre").max(60),
  rsvp: z.enum(["va", "quiza", "no"]),
  companions: z.coerce.number().int().min(0).max(10).default(0),
});

/**
 * Apuntarse o cambiar la respuesta.
 *
 * Se escribe con la clave de servicio porque quien responde puede no tener
 * cuenta: la autorización es el token del enlace, que se comprueba aquí.
 * Nunca se acepta un `plan_id` del navegador, solo el token.
 */
export async function rsvpPlanAction(input: unknown): Promise<ActionResult> {
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: plan } = await admin
      .from("plans")
      .select("id, closed_at")
      .eq("token", parsed.data.token)
      .maybeSingle();

    if (!plan) return { ok: false, error: "Este plan ya no existe" };
    if (plan.closed_at) return { ok: false, error: "El plan está cerrado" };

    const session = await getSession();

    if (session) {
      // Con sesión, la respuesta es de esa cuenta: una persona, una fila.
      const { data: mine } = await admin
        .from("plan_members")
        .select("id")
        .eq("plan_id", plan.id as string)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (mine) {
        const { error } = await admin
          .from("plan_members")
          .update({
            display_name: parsed.data.displayName,
            rsvp: parsed.data.rsvp,
            companions: parsed.data.companions,
          })
          .eq("id", mine.id as string);
        if (error) return { ok: false, error: error.message };
        revalidatePath(`/planes/${parsed.data.token}`);
        return { ok: true };
      }
    }

    const { error } = await admin.from("plan_members").insert({
      plan_id: plan.id as string,
      user_id: session?.user.id ?? null,
      display_name: parsed.data.displayName,
      rsvp: parsed.data.rsvp,
      companions: parsed.data.companions,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/planes/${parsed.data.token}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar tu respuesta",
    };
  }
}

export async function closePlanAction(token: unknown): Promise<ActionResult> {
  const parsed = z.string().min(10).max(64).safeParse(token);
  if (!parsed.success) return { ok: false, error: "Plan inválido" };

  const session = await getSession();
  if (!session) return { ok: false, error: "Inicia sesión" };

  // La política RLS solo deja tocar los planes propios, así que basta con el
  // cliente de sesión: no hace falta comprobar el dueño a mano.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("plans")
    .update({ closed_at: new Date().toISOString() })
    .eq("token", parsed.data);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/planes/${parsed.data}`);
  revalidatePath("/cuenta/planes");
  return { ok: true };
}
