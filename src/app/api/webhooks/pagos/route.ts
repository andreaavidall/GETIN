import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { confirmPaidOrder } from "@/lib/orders/service";
import { getPaymentProvider } from "@/lib/payments";
import { markPaymentFailed } from "@/lib/payments/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Webhook de pagos. Es el UNICO lugar donde una orden pasa a "pagada".
 *
 * Secuencia:
 *   1. Leer el cuerpo en crudo (la firma se calcula sobre los bytes exactos).
 *   2. Verificar la firma. Si no es valida: 401 y se registra el intento.
 *   3. Guardar el evento en payment_webhook_events. El UNIQUE
 *      (provider, provider_event_id) hace la idempotencia: un reintento del
 *      proveedor no vuelve a emitir entradas.
 *   4. Segun el estado, confirmar o marcar fallido.
 *
 * Se responde 200 tambien cuando el evento ya estaba procesado, para que el
 * proveedor deje de reintentar.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headerMap: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headerMap[key.toLowerCase()] = value;
  });

  const provider = getPaymentProvider();
  const verification = await provider.verifyWebhook(rawBody, headerMap);

  if (!verification.valid) {
    await recordAudit({
      action: "payment.webhook_rejected",
      entity: "payment_webhook_events",
      metadata: { provider: provider.name, reason: verification.reason },
    });
    // 401: la firma no cuadra. No se revela nada mas.
    return NextResponse.json({ error: "firma invalida" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // Idempotencia: si ya existe este provider_event_id, no se reprocesa.
  const { data: inserted, error: insertError } = await admin
    .from("payment_webhook_events")
    .insert({
      provider: provider.name,
      provider_event_id: verification.providerEventId,
      event_type: verification.eventType,
      signature_valid: true,
      order_id: verification.orderId,
      payload: verification.payload as object,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    // 23505 = unique_violation -> evento repetido, ya se trato.
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[webhook] no se pudo registrar el evento", insertError);
    return NextResponse.json({ error: "error interno" }, { status: 500 });
  }

  const eventRowId = inserted?.id as string | undefined;

  try {
    if (verification.status === "paid") {
      if (!verification.orderId) {
        throw new Error("el evento no trae orderId");
      }

      // Localiza el pago por el id del proveedor para cerrarlo tambien.
      const { data: payment } = await admin
        .from("payments")
        .select("id, amount_cents, order_id")
        .eq("provider_payment_id", verification.providerPaymentId)
        .maybeSingle();

      // El importe informado por el proveedor tiene que coincidir con el cobrado.
      if (
        payment &&
        verification.amountCents !== null &&
        Number(payment.amount_cents) !== verification.amountCents
      ) {
        throw new Error(
          `importe distinto: esperado ${payment.amount_cents}, informado ${verification.amountCents}`,
        );
      }

      // Solo metadatos de la tarjeta (marca y 4 ultimos). Nunca el numero ni el CVV.
      if (verification.card) {
        await admin
          .from("payments")
          .update({
            card_brand: verification.card.brand ?? null,
            card_last4: verification.card.last4 ?? null,
          })
          .eq("provider_payment_id", verification.providerPaymentId);
      }

      const result = await confirmPaidOrder({
        orderId: verification.orderId,
        paymentId: (payment?.id as string | undefined) ?? null,
      });

      await admin
        .from("payment_webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("id", eventRowId!);

      return NextResponse.json({
        ok: true,
        tickets: result.ticketCount,
        alreadyConfirmed: result.alreadyConfirmed,
      });
    }

    if (verification.status === "failed") {
      await markPaymentFailed({
        providerPaymentId: verification.providerPaymentId,
        failureCode: verification.eventType,
        failureMessage: "El proveedor rechazo el pago",
      });
    }

    if (verification.status === "refunded") {
      await admin
        .from("payments")
        .update({ status: "refunded" })
        .eq("provider_payment_id", verification.providerPaymentId);
      if (verification.orderId) {
        await admin.from("orders").update({ status: "refunded" }).eq("id", verification.orderId);
        await admin
          .from("tickets")
          .update({ status: "refunded" })
          .eq("order_id", verification.orderId)
          .eq("status", "issued");
      }
    }

    await admin
      .from("payment_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", eventRowId!);

    return NextResponse.json({ ok: true, status: verification.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "error desconocido";
    await admin
      .from("payment_webhook_events")
      .update({ processed: false, error: message })
      .eq("id", eventRowId!);

    console.error("[webhook] fallo al procesar", message);
    // 500 para que el proveedor reintente: el evento quedo registrado sin procesar.
    return NextResponse.json({ error: "no se pudo procesar" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "este endpoint solo acepta POST firmado por el proveedor de pagos" },
    { status: 405 },
  );
}
