/**
 * Puerto de pagos.
 *
 * La aplicación no conoce ninguna pasarela concreta: habla con esta interfaz.
 * Cambiar de Culqi a Niubiz o Mercado Pago significa escribir un adaptador
 * nuevo, no tocar el checkout.
 *
 * Reglas que todo adaptador debe respetar:
 *  1. Nunca almacenar el número completo de la tarjeta ni el CVV. El dato
 *     sensible viaja del navegador a la pasarela y vuelve como token.
 *  2. Una orden se da por pagada SOLO cuando lo confirma el proveedor por un
 *     webhook con firma válida (o una consulta directa a su API). Nunca por una
 *     redireccion del navegador a una página de exito.
 *  3. `verifyWebhook` tiene que validar la firma antes de leer el cuerpo.
 *  4. Los reintentos del proveedor son normales: `providerEventId` es la clave
 *     de idempotencia.
 */

export type PaymentIntentRequest = {
  orderId: string;
  orderCode: string;
  amountCents: number;
  currency: "PEN";
  description: string;
  customer: {
    email: string;
    name?: string | null;
    phone?: string | null;
  };
  /** URL a la que vuelve el comprador. Informativa: no confirma nada. */
  returnUrl: string;
  /** Clave de idempotencia de la aplicación. */
  idempotencyKey: string;
};

export type PaymentIntent = {
  provider: string;
  /** Identificador del pago en el proveedor. */
  providerPaymentId: string;
  status: "initiated" | "pending" | "authorized" | "paid" | "failed";
  /** A donde hay que llevar al comprador (checkout hospedado o formulario). */
  redirectUrl?: string;
  /** Datos publicos que necesita el formulario en el navegador. */
  clientConfig?: Record<string, string>;
  expiresAt?: string;
};

/** Estado al que pasa el pago según el proveedor. */
export type PaymentWebhookStatus = "paid" | "failed" | "pending" | "refunded" | "chargeback";

export type WebhookVerification =
  | {
      valid: true;
      providerEventId: string;
      eventType: string;
      status: PaymentWebhookStatus;
      providerPaymentId: string;
      orderId: string | null;
      amountCents: number | null;
      card?: { brand?: string; last4?: string };
      payload: unknown;
    }
  | { valid: false; reason: string; payload?: unknown };

export type RefundRequest = {
  providerPaymentId: string;
  amountCents: number;
  reason: string;
  idempotencyKey: string;
};

export type RefundResult = {
  providerRefundId: string;
  status: "processed" | "pending" | "failed";
  message?: string;
};

export interface PaymentProvider {
  readonly name: string;
  /** ¿Puede cobrar de verdad, o es un simulador / le faltan credenciales? */
  readonly isLive: boolean;
  /** Texto que se muestra al usuario sobre el estado de la integración. */
  readonly statusNote: string;

  createIntent(request: PaymentIntentRequest): Promise<PaymentIntent>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookVerification>;
  refund(request: RefundRequest): Promise<RefundResult>;
}

export class PaymentProviderNotConfiguredError extends Error {
  readonly status = 503;
  constructor(provider: string, missing: string[]) {
    super(
      `El proveedor de pagos "${provider}" no esta configurado. Faltan: ${missing.join(", ")}.`,
    );
    this.name = "PaymentProviderNotConfiguredError";
  }
}
