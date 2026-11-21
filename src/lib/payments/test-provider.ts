import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  PaymentIntent,
  PaymentIntentRequest,
  PaymentProvider,
  PaymentWebhookStatus,
  RefundRequest,
  RefundResult,
  WebhookVerification,
} from "@/lib/payments/types";

/**
 * ADAPTADOR DE PRUEBAS — NO COBRA DINERO.
 *
 * Reproduce el ciclo completo de una pasarela real para poder desarrollar y
 * probar el checkout de punta a punta:
 *
 *   1. `createIntent` devuelve un pago "pending" y una URL interna
 *      (/checkout/simulador) donde se elige el desenlace.
 *   2. El simulador manda un webhook firmado con HMAC-SHA256 a
 *      /api/webhooks/pagos, igual que lo haria Culqi.
 *   3. Solo ese webhook confirma la orden y emite los QR.
 *
 * El paso 2 es a proposito: asi el camino de confirmacion que se prueba en
 * desarrollo es exactamente el que se usara en produccion.
 */
export class TestPaymentProvider implements PaymentProvider {
  readonly name = "test";
  readonly isLive = false;
  readonly statusNote =
    "Modo de pruebas: ningun cargo real. Las ordenes se confirman con un webhook simulado.";

  constructor(private readonly webhookSecret: string) {}

  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    const providerPaymentId = `test_${randomUUID()}`;
    const params = new URLSearchParams({
      pago: providerPaymentId,
      orden: request.orderId,
      monto: String(request.amountCents),
    });
    return {
      provider: this.name,
      providerPaymentId,
      status: "pending",
      redirectUrl: `/checkout/simulador?${params.toString()}`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  /** Firma que el simulador adjunta en la cabecera `x-getin-signature`. */
  sign(rawBody: string): string {
    return createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
  }

  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookVerification> {
    const received = headers["x-getin-signature"] ?? "";
    const expected = this.sign(rawBody);

    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: "firma invalida" };
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { valid: false, reason: "cuerpo no es JSON" };
    }

    const outcome = String(body.outcome ?? "");
    const statusMap: Record<string, PaymentWebhookStatus> = {
      paid: "paid",
      failed: "failed",
      pending: "pending",
      refunded: "refunded",
    };
    const status = statusMap[outcome];
    if (!status) {
      return { valid: false, reason: `outcome desconocido: ${outcome}`, payload: body };
    }

    return {
      valid: true,
      providerEventId: String(body.eventId ?? randomUUID()),
      eventType: `payment.${outcome}`,
      status,
      providerPaymentId: String(body.paymentId ?? ""),
      orderId: body.orderId ? String(body.orderId) : null,
      amountCents: typeof body.amountCents === "number" ? body.amountCents : null,
      card: { brand: "Visa (prueba)", last4: "4242" },
      payload: body,
    };
  }

  async refund(_request: RefundRequest): Promise<RefundResult> {
    return {
      providerRefundId: `test_refund_${randomUUID()}`,
      status: "processed",
      message: "Reembolso simulado: no se movio dinero real.",
    };
  }
}
