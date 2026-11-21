import "server-only";

import { recordAudit } from "@/lib/audit";
import { publicEnv } from "@/lib/env";
import { assertOrderAmountIntact, OrderError } from "@/lib/orders/service";
import { getPaymentProvider } from "@/lib/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Arranque del pago.
 *
 * Importante: esta funcion NO marca nada como pagado. Solo crea la intencion en
 * el proveedor y devuelve a donde hay que llevar al comprador. La confirmacion
 * llega despues, por webhook firmado.
 */
export async function startPaymentForOrder(input: {
  orderId: string;
  userId: string;
}): Promise<{ redirectUrl: string; paymentId: string; providerName: string; isLive: boolean }> {
  const admin = createSupabaseAdminClient();
  const provider = getPaymentProvider();

  const { data: order } = await admin
    .from("orders")
    .select("id, code, user_id, status, total_cents, buyer_email, buyer_name, buyer_phone, expires_at, event_id")
    .eq("id", input.orderId)
    .maybeSingle();

  if (!order || order.user_id !== input.userId) {
    throw new OrderError("Orden no encontrada", "internal", 404);
  }
  if (order.status === "paid") {
    throw new OrderError("Esta orden ya esta pagada", "internal", 409);
  }
  if (!["pending", "awaiting_payment", "failed"].includes(order.status as string)) {
    throw new OrderError(`La orden esta en estado ${order.status} y no se puede pagar`, "internal", 409);
  }
  if (order.expires_at && new Date(order.expires_at as string) <= new Date()) {
    throw new OrderError("La reserva vencio. Vuelve a seleccionar tus entradas.", "internal", 410);
  }

  // Red de seguridad: el importe se recalcula desde los conceptos.
  const amountCents = await assertOrderAmountIntact(input.orderId);

  // Reutiliza un pago ya iniciado para la misma orden (idempotencia).
  const { data: existing } = await admin
    .from("payments")
    .select("id, provider, provider_payment_id, status")
    .eq("order_id", input.orderId)
    .in("status", ["initiated", "pending"])
    .maybeSingle();

  const intent = await provider.createIntent({
    orderId: input.orderId,
    orderCode: order.code as string,
    amountCents,
    currency: "PEN",
    description: `Entradas GETIN ${order.code}`,
    customer: {
      email: (order.buyer_email as string) ?? "",
      name: order.buyer_name as string | null,
      phone: order.buyer_phone as string | null,
    },
    returnUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/checkout/${input.orderId}/resultado`,
    idempotencyKey: `${input.orderId}:${order.code}`,
  });

  let paymentId: string;
  if (existing) {
    paymentId = existing.id as string;
    await admin
      .from("payments")
      .update({
        provider: intent.provider,
        provider_payment_id: intent.providerPaymentId,
        status: intent.status === "paid" ? "pending" : intent.status,
      })
      .eq("id", paymentId);
  } else {
    const { data: created, error } = await admin
      .from("payments")
      .insert({
        order_id: input.orderId,
        provider: intent.provider,
        provider_payment_id: intent.providerPaymentId,
        // Nunca 'paid' aqui: eso solo lo decide el webhook.
        status: intent.status === "paid" ? "pending" : intent.status,
        amount_cents: amountCents,
        currency: "PEN",
      })
      .select("id")
      .single();

    if (error || !created) {
      throw new OrderError(`No se pudo registrar el pago: ${error?.message}`, "internal", 500);
    }
    paymentId = created.id as string;
  }

  await admin.from("orders").update({ status: "awaiting_payment" }).eq("id", input.orderId);

  await recordAudit({
    action: "payment.intent",
    entity: "payments",
    entityId: paymentId,
    actorId: input.userId,
    metadata: { provider: intent.provider, amount_cents: amountCents, order_code: order.code },
  });

  if (!intent.redirectUrl) {
    throw new OrderError("El proveedor de pagos no devolvio a donde continuar", "internal", 502);
  }

  return {
    redirectUrl: intent.redirectUrl,
    paymentId,
    providerName: provider.name,
    isLive: provider.isLive,
  };
}

/** Marca un pago como fallido (lo llama el webhook). */
export async function markPaymentFailed(input: {
  providerPaymentId: string;
  failureCode?: string;
  failureMessage?: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id")
    .eq("provider_payment_id", input.providerPaymentId)
    .maybeSingle();

  if (!payment) return;

  await admin
    .from("payments")
    .update({
      status: "failed",
      failure_code: input.failureCode ?? null,
      failure_message: input.failureMessage ?? null,
    })
    .eq("id", payment.id as string);

  // La orden vuelve a 'pending': el comprador puede reintentar mientras la
  // retencion siga viva, en lugar de perder la seleccion.
  await admin.from("orders").update({ status: "pending" }).eq("id", payment.order_id as string);

  await recordAudit({
    action: "payment.failed",
    entity: "payments",
    entityId: payment.id as string,
    metadata: { code: input.failureCode, message: input.failureMessage },
  });
}
