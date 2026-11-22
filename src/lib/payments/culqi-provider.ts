import { createHmac, timingSafeEqual } from "node:crypto";

import {
  PaymentProviderNotConfiguredError,
  type PaymentIntent,
  type PaymentIntentRequest,
  type PaymentProvider,
  type RefundRequest,
  type RefundResult,
  type WebhookVerification,
} from "@/lib/payments/types";

/**
 * Adaptador de Culqi (Perú).
 *
 * ESTADO: estructura lista, NO verificado contra la API real. No tengo
 * credenciales ni puedo probar el flujo, así que:
 *
 *  - Si faltan CULQI_SECRET_KEY / CULQI_PUBLIC_KEY, cada metodo lanza
 *    PaymentProviderNotConfiguredError en lugar de fingir que funciona.
 *  - El formato exacto de la firma del webhook y los nombres de los campos
 *    deben confirmarse con la documentacion vigente de Culqi antes de activarlo
 *    en produccion. Los puntos a revisar estan marcados con TODO(culqi).
 *
 * Como activarlo: ver docs/PAGOS.md
 *
 * Por que Culqi y no Stripe: Stripe no procesa pagos con entidades peruanas.
 * Culqi, Niubiz, Izipay y Mercado Pago si. Culqi tiene la integración mas
 * sencilla por token de tarjeta y buen soporte de Yape, que es relevante aquí.
 */
const CULQI_API = "https://api.culqi.com/v2";

export class CulqiPaymentProvider implements PaymentProvider {
  readonly name = "culqi";

  constructor(
    private readonly publicKey: string,
    private readonly secretKey: string,
    private readonly webhookSecret: string,
  ) {}

  get isLive(): boolean {
    return Boolean(this.secretKey && this.publicKey);
  }

  get statusNote(): string {
    if (!this.isLive) {
      return "Culqi seleccionado pero sin credenciales: no se pueden cobrar pagos.";
    }
    if (this.secretKey.startsWith("sk_test")) {
      return "Culqi en modo de pruebas (claves sk_test): usa las tarjetas de prueba de Culqi.";
    }
    return "Culqi en modo produccion.";
  }

  private assertConfigured(): void {
    const missing: string[] = [];
    if (!this.publicKey) missing.push("CULQI_PUBLIC_KEY");
    if (!this.secretKey) missing.push("CULQI_SECRET_KEY");
    if (missing.length > 0) {
      throw new PaymentProviderNotConfiguredError(this.name, missing);
    }
  }

  /**
   * Con Culqi el cargo se crea con un token de tarjeta generado en el navegador
   * por culqi.js, de modo que el PAN y el CVV nunca pasan por nuestro servidor.
   * Aquí solo preparamos la intencion y devolvemos la clave publica para el
   * formulario; el cargo se crea en /api/checkout/culqi con el token recibido.
   */
  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    this.assertConfigured();
    return {
      provider: this.name,
      providerPaymentId: `pending_${request.idempotencyKey}`,
      status: "initiated",
      clientConfig: { publicKey: this.publicKey },
      redirectUrl: `/checkout/${request.orderId}/pago`,
    };
  }

  /** Crea el cargo con el token de tarjeta devuelto por culqi.js. */
  async createCharge(input: {
    cardToken: string;
    amountCents: number;
    email: string;
    orderCode: string;
    idempotencyKey: string;
  }): Promise<{ providerPaymentId: string; status: "paid" | "pending" | "failed"; raw: unknown }> {
    this.assertConfigured();

    const response = await fetch(`${CULQI_API}/charges`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        // TODO(culqi): confirmar el nombre de la cabecera de idempotencia.
        "X-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        amount: input.amountCents, // Culqi usa la unidad minima (centimos)
        currency_code: "PEN",
        email: input.email,
        source_id: input.cardToken,
        description: `GETIN ${input.orderCode}`,
        metadata: { order_code: input.orderCode },
      }),
    });

    const raw: unknown = await response.json();
    if (!response.ok) {
      return { providerPaymentId: "", status: "failed", raw };
    }
    const body = raw as { id?: string; outcome?: { type?: string } };
    const paid = body.outcome?.type === "venta_exitosa";
    return {
      providerPaymentId: body.id ?? "",
      status: paid ? "paid" : "pending",
      raw,
    };
  }

  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      return { valid: false, reason: "CULQI_WEBHOOK_SECRET no configurado" };
    }

    // TODO(culqi): confirmar el nombre de la cabecera y el algoritmo exactos en
    // la documentacion de Culqi antes de habilitar esto en produccion.
    const received = headers["x-culqi-signature"] ?? headers["culqi-signature"] ?? "";
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: "firma inválida" };
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { valid: false, reason: "cuerpo no es JSON" };
    }

    const type = String(body.type ?? body.event ?? "");
    const data = (body.data ?? {}) as Record<string, unknown>;
    const metadata = (data.metadata ?? {}) as Record<string, unknown>;

    const status =
      type.includes("charge.creation.succeeded") || type.includes("venta_exitosa")
        ? "paid"
        : type.includes("refund")
          ? "refunded"
          : type.includes("failed")
            ? "failed"
            : "pending";

    return {
      valid: true,
      providerEventId: String(body.id ?? data.id ?? ""),
      eventType: type || "unknown",
      status,
      providerPaymentId: String(data.id ?? ""),
      orderId: metadata.order_id ? String(metadata.order_id) : null,
      amountCents: typeof data.amount === "number" ? data.amount : null,
      payload: body,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    this.assertConfigured();
    const response = await fetch(`${CULQI_API}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": request.idempotencyKey,
      },
      body: JSON.stringify({
        charge_id: request.providerPaymentId,
        amount: request.amountCents,
        reason: "solicitud_comprador",
        metadata: { motivo: request.reason },
      }),
    });
    const raw = (await response.json()) as { id?: string };
    if (!response.ok) {
      return { providerRefundId: "", status: "failed", message: "Culqi rechazo el reembolso" };
    }
    return { providerRefundId: raw.id ?? "", status: "processed" };
  }
}
