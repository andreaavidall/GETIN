import { CreditCard, Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CheckoutActions } from "@/components/checkout/checkout-actions";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/guards";
import { getOrder } from "@/lib/data/orders";
import { getPaymentProvider } from "@/lib/payments";
import { formatEventDate, formatPEN } from "@/lib/utils";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

type Params = Promise<{ orderId: string }>;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente de pago",
  awaiting_payment: "Esperando confirmacion del proveedor",
  paid: "Pagada",
  failed: "Pago rechazado",
  expired: "Reserva vencida",
  cancelled: "Cancelada",
  refunded: "Reembolsada",
};

export default async function CheckoutPage({ params }: { params: Params }) {
  const { orderId } = await params;
  await requireSession(`/checkout/${orderId}`);

  // RLS ya limita la orden al comprador: si no es suya, no aparece.
  const order = await getOrder(orderId);
  if (!order) notFound();

  const provider = getPaymentProvider();
  const payable = ["pending", "awaiting_payment", "failed"].includes(order.status);
  const expired = order.expiresAt !== null && order.expiresAt <= new Date();

  return (
    <div className="container max-w-3xl py-10">
      <nav className="mb-6 text-xs text-muted">
        <Link href={`/eventos/${order.event.slug}`} className="hover:text-paper">
          ← Volver al evento
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-3xl">Resumen del pedido</h1>
          <p className="mt-1 text-sm text-muted">
            Orden <span className="font-mono text-paper">{order.code}</span>
          </p>
        </div>
        <Badge variant={order.status === "paid" ? "success" : expired ? "danger" : "neutral"}>
          {expired && payable ? "Reserva vencida" : (STATUS_LABEL[order.status] ?? order.status)}
        </Badge>
      </header>

      <div className="space-y-4">
        {/* ------------------------------------------------------- evento */}
        <section className="surface p-5">
          <p className="text-[11px] uppercase tracking-wide text-lime">
            {order.event.venueName} · {order.event.district}
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">{order.event.name}</h2>
          <p className="mt-1 text-sm text-muted">{formatEventDate(order.event.startsAt)}</p>
        </section>

        {/* ---------------------------------------------------- conceptos */}
        <section className="surface overflow-hidden">
          <h2 className="border-b border-white/10 p-5 font-display text-base font-semibold">
            Lo que estas comprando
          </h2>
          <ul className="divide-y divide-white/5">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {item.quantity} × {formatPEN(item.unitPriceCents)}
                    {item.kind === "table" ? " · adelanto de la mesa" : null}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{formatPEN(item.totalCents)}</p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-white/10 bg-white/[0.02] p-5 text-sm">
            <Row label="Subtotal" value={formatPEN(order.subtotalCents)} />
            <Row
              label={`Cargo por servicio GETIN (${(order.commissionBps / 100).toFixed(2)}%)`}
              value={formatPEN(order.serviceFeeCents)}
            />
            <Row
              label="IGV incluido en el precio del local (informativo)"
              value={formatPEN(order.taxCents)}
              muted
            />
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <dt className="font-semibold">Total a pagar</dt>
              <dd className="font-display text-2xl font-bold text-lime">
                {formatPEN(order.totalCents)}
              </dd>
            </div>
          </dl>
        </section>

        {/* --------------------------------------------------- condiciones */}
        {order.event.cancellationPolicy ? (
          <section className="surface p-5">
            <h2 className="font-display text-base font-semibold">Politica de cancelacion</h2>
            <p className="mt-1 text-sm text-muted">{order.event.cancellationPolicy}</p>
            <p className="mt-3 text-xs text-muted">
              Al pagar aceptas esta politica, los{" "}
              <Link href="/legal/terminos" className="text-lime hover:underline">
                terminos del servicio
              </Link>{" "}
              y la{" "}
              <Link href="/legal/privacidad" className="text-lime hover:underline">
                politica de privacidad
              </Link>
              .
            </p>
          </section>
        ) : null}

        {/* ---------------------------------------------------------- pago */}
        <section className="surface p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <CreditCard className="size-4 text-lime" />
            Pago
          </h2>

          <div className="mt-3 space-y-2 text-xs text-muted">
            <p className="flex items-start gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-lime" />
              Los datos de la tarjeta se envian directamente al proveedor de pagos. GETIN no
              almacena el numero de tarjeta ni el codigo de seguridad.
            </p>
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-lime" />
              Tu entrada y su codigo QR se emiten cuando el proveedor confirma el pago, no al
              volver a esta pagina.
            </p>
          </div>

          <div
            className={`mt-4 rounded-xl border p-3 text-xs ${
              provider.isLive
                ? "border-white/10 bg-white/[0.03] text-muted"
                : "border-amber-400/30 bg-amber-400/[0.08] text-amber-100/90"
            }`}
          >
            <strong className="font-semibold">Proveedor: {provider.name}.</strong>{" "}
            {provider.statusNote}
          </div>

          <CheckoutActions
            orderId={order.id}
            status={order.status}
            expiresAt={order.expiresAt?.toISOString() ?? null}
            totalLabel={formatPEN(order.totalCents)}
            eventSlug={order.event.slug}
          />
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={muted ? "text-xs text-muted" : "text-muted"}>{label}</dt>
      <dd className={muted ? "text-xs text-muted" : ""}>{value}</dd>
    </div>
  );
}
