import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { publicEnv, serverEnv } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { TestPaymentProvider } from "@/lib/payments/test-provider";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Puente del SIMULADOR de pagos (solo con PAYMENTS_PROVIDER=test).
 *
 * Firma un webhook con el secreto del servidor y lo entrega al endpoint real
 * /api/webhooks/pagos. De esta forma el camino de confirmación que se ejercita
 * en desarrollo es exactamente el de produccion, incluida la verificación de
 * firma y la idempotencia.
 *
 * Con un proveedor real esta ruta responde 404.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  orderId: z.string().uuid(),
  paymentId: z.string().min(4),
  outcome: z.enum(["paid", "failed", "pending", "refunded"]),
});

export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (!(provider instanceof TestPaymentProvider)) {
    return NextResponse.json({ error: "no disponible" }, { status: 404 });
  }

  // Aunque sea un simulador, exige sesión y que la orden sea del usuario:
  // no debe servir para confirmar la orden de otra persona.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "necesitas iniciar sesión" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "cuerpo invalido" }, { status: 400 });
  }
  const { orderId, paymentId, outcome } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, total_cents")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.user_id !== session.user.id) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  const payload = JSON.stringify({
    eventId: randomUUID(),
    paymentId,
    orderId,
    outcome,
    amountCents: Number(order.total_cents),
    simulated: true,
  });

  const signature = provider.sign(payload);

  const webhookUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/webhooks/pagos`;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-getin-signature": signature,
      "user-agent": "getin-payment-simulator",
    },
    body: payload,
  });

  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: (result.error as string) ?? `webhook respondio ${response.status}` },
      { status: 502 },
    );
  }

  // El secreto nunca se devuelve al navegador; solo el resultado.
  void serverEnv();
  return NextResponse.json({ ok: true, webhook: result });
}
