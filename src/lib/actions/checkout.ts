"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { assertCan } from "@/lib/domain/permissions";
import { dataMode } from "@/lib/env";
import { cancelOrder, createOrderFromCart, OrderError } from "@/lib/orders/service";
import { startPaymentForOrder } from "@/lib/payments/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cartSchema, guestListJoinSchema } from "@/lib/validation/schemas";

/**
 * Server actions del flujo de compra.
 *
 * Cada una:
 *  1. exige sesión y permiso (no basta con que el boton este visible),
 *  2. válida la entrada con zod,
 *  3. delega en el servicio, que recalcula precios y usa las funciones atomicas.
 *
 * Devuelven un resultado en lugar de lanzar, para que el formulario pueda
 * mostrar el error sin perder lo que el usuario habia seleccionado.
 */
export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string };

function fail(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof OrderError) return { ok: false, error: error.message, code: error.code };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Ocurrio un error inesperado" };
}

export async function createOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string; code: string }>> {
  try {
    if (dataMode() === "demo") {
      return {
        ok: false,
        error:
          "Estás en modo demostracion: los eventos son ficticios y no se puede comprar. Configura Supabase y un proveedor de pagos para habilitar el checkout.",
        code: "demo_mode",
      };
    }

    const session = await getSession();
    assertCan(session?.actor ?? null, "order.create");
    if (!session) return { ok: false, error: "Necesitas iniciar sesión" };

    const parsed = cartSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Selección inválida" };
    }

    const order = await createOrderFromCart(parsed.data, {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.fullName,
      phone: session.user.phone,
    });

    revalidatePath("/eventos");
    return { ok: true, orderId: order.orderId, code: order.code };
  } catch (error) {
    return fail(error);
  }
}

export async function startPaymentAction(
  orderId: string,
): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const session = await getSession();
    assertCan(session?.actor ?? null, "order.create");
    if (!session) return { ok: false, error: "Necesitas iniciar sesión" };

    const result = await startPaymentForOrder({ orderId, userId: session.user.id });
    return { ok: true, redirectUrl: result.redirectUrl };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "Necesitas iniciar sesión" };

    await cancelOrder(orderId, session.user.id);
    revalidatePath("/cuenta/compras");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function joinGuestListAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  try {
    if (dataMode() === "demo") {
      return {
        ok: false,
        error: "Modo demostracion: las listas de esta pantalla son ficticias.",
        code: "demo_mode",
      };
    }

    const session = await getSession();
    assertCan(session?.actor ?? null, "guestList.join");
    if (!session) return { ok: false, error: "Necesitas iniciar sesión" };

    const parsed = guestListJoinSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
    }

    // La inscripción pasa por la funcion atomica: controla cupo y cierre.
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("getin_join_guest_list", {
      p_guest_list_id: parsed.data.guestListId,
      p_guest_name: parsed.data.guestName,
      p_companions: parsed.data.companions,
    });

    if (error) {
      const message = error.message.includes("LIST_CLOSED")
        ? "La inscripción a esta lista ya cerro"
        : error.message.includes("LIST_UNAVAILABLE")
          ? "Esta lista no esta disponible"
          : error.message;
      return { ok: false, error: message };
    }

    const status = (data as { status?: string } | null)?.status ?? "pending";

    await recordAudit({
      action: "guestEntry.decide",
      entity: "guest_list_entries",
      entityId: parsed.data.guestListId,
      actorId: session.user.id,
      metadata: { status, auto: true },
    });

    revalidatePath("/cuenta/listas");
    return { ok: true, status };
  } catch (error) {
    return fail(error);
  }
}
