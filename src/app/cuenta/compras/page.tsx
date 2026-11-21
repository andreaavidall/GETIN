import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState } from "@/components/ui/feedback";
import { isDemoMode } from "@/lib/data/catalog";
import { listMyOrders } from "@/lib/data/orders";
import { formatEventDate, formatPEN } from "@/lib/utils";

export const metadata: Metadata = { title: "Historial de compras", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "outline" | "danger" }> = {
  paid: { label: "Pagada", variant: "success" },
  pending: { label: "Pendiente de pago", variant: "warning" },
  awaiting_payment: { label: "Esperando confirmacion", variant: "warning" },
  failed: { label: "Pago rechazado", variant: "danger" },
  expired: { label: "Vencida", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "outline" },
  refunded: { label: "Reembolsada", variant: "outline" },
  partially_refunded: { label: "Reembolso parcial", variant: "outline" },
};

export default async function PurchaseHistoryPage() {
  if (isDemoMode()) {
    return (
      <div className="space-y-4">
        <DemoNotice />
        <EmptyState icon={Receipt} title="Sin compras en modo demostracion" />
      </div>
    );
  }

  const orders = await listMyOrders();

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Sin compras todavia"
        description="Aqui apareceran tus ordenes con su desglose: precio del local, cargo por servicio e impuestos."
        action={
          <Button asChild>
            <Link href="/eventos">Explorar eventos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const status = STATUS[order.status] ?? { label: order.status, variant: "outline" as const };
        const payable = ["pending", "awaiting_payment", "failed"].includes(order.status);

        return (
          <article key={order.id} className="surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-muted">{order.code}</p>
                <h2 className="mt-1 truncate font-display text-base font-semibold">
                  <Link href={`/eventos/${order.event.slug}`} className="hover:text-lime">
                    {order.event.name}
                  </Link>
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {order.event.venueName} · {formatEventDate(order.event.startsAt)}
                </p>
              </div>
              <div className="text-right">
                <Badge variant={status.variant}>{status.label}</Badge>
                <p className="mt-2 font-display text-lg font-bold">
                  {formatPEN(order.totalCents)}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-1 border-t border-white/5 pt-4 text-xs text-muted">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4">
                  <span>
                    {item.quantity} × {item.description}
                  </span>
                  <span>{formatPEN(item.totalCents)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-4 pt-1">
                <span>Cargo por servicio</span>
                <span>{formatPEN(order.serviceFeeCents)}</span>
              </li>
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              {payable ? (
                <Button asChild size="sm">
                  <Link href={`/checkout/${order.id}`}>Continuar el pago</Link>
                </Button>
              ) : null}
              {order.status === "paid" ? (
                <>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/cuenta/entradas">Ver entradas</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/cuenta/soporte?orden=${order.code}`}>Pedir reembolso</Link>
                  </Button>
                </>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
