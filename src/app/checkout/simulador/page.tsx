import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SimulatorForm } from "@/components/checkout/simulator-form";
import { requireSession } from "@/lib/auth/guards";
import { getOrder } from "@/lib/data/orders";
import { getPaymentProvider } from "@/lib/payments";
import { formatPEN } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Simulador de pago",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ pago?: string; orden?: string; monto?: string }>;

/**
 * Pantalla del ADAPTADOR DE PRUEBAS. No existe con una pasarela real.
 *
 * Sirve para recorrer el mismo camino que en produccion: elegir un desenlace
 * hace que el servidor firme un webhook y lo entregue al endpoint real. Asi, lo
 * que se prueba en desarrollo es el codigo que confirmara los pagos de verdad.
 */
export default async function SimulatorPage({ searchParams }: { searchParams: SearchParams }) {
  const { pago, orden } = await searchParams;
  await requireSession("/cuenta");

  if (!pago || !orden) notFound();
  if (getPaymentProvider().name !== "test") notFound();

  const order = await getOrder(orden);
  if (!order) notFound();

  return (
    <div className="container max-w-xl py-14">
      <div className="surface overflow-hidden">
        <div className="flex items-start gap-3 border-b border-amber-400/30 bg-amber-400/[0.08] p-5">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div>
            <h1 className="font-display text-lg font-semibold">Pago de demostracion</h1>
            <p className="mt-1 text-sm text-amber-100/90">
              GETIN todavia no tiene una pasarela conectada, asi que{" "}
              <strong>aqui no se cobra nada</strong>. Escribe cualquier tarjeta: sirve para
              recorrer la compra completa y recibir tu codigo QR.
            </p>
          </div>
        </div>

        <dl className="space-y-2 p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Orden</dt>
            <dd className="font-mono">{order.code}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Evento</dt>
            <dd className="text-right">{order.event.name}</dd>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2">
            <dt className="font-medium">Importe</dt>
            <dd className="font-display text-lg font-bold text-lime">
              {formatPEN(order.totalCents)}
            </dd>
          </div>
        </dl>

        <div className="border-t border-white/10 p-5">
          <SimulatorForm
            orderId={order.id}
            paymentId={pago}
            amountLabel={formatPEN(order.totalCents)}
          />
        </div>
      </div>
    </div>
  );
}
