import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/guards";
import { getOrder } from "@/lib/data/orders";
import { formatEventDate, formatPEN } from "@/lib/utils";

export const metadata: Metadata = { title: "Resultado del pago", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Promise<{ orderId: string }>;

/**
 * Pantalla de retorno del proveedor de pagos.
 *
 * Deliberadamente NO da por bueno el pago porque el navegador haya llegado
 * aquí: lee el estado real de la orden, que solo cambia a "paid" cuando el
 * webhook firmado lo confirma. Si el usuario vuelve antes de que llegue el
 * webhook, ve "procesando" y la página se refresca.
 */
export default async function PaymentResultPage({ params }: { params: Params }) {
  const { orderId } = await params;
  await requireSession(`/checkout/${orderId}/resultado`);

  const order = await getOrder(orderId);
  if (!order) notFound();

  if (order.status === "paid") {
    return (
      <Shell
        icon={<CheckCircle2 className="size-12 text-lime" />}
        title="Pago confirmado"
        detail={`Pagaste ${formatPEN(order.totalCents)} por ${order.event.name}.`}
      >
        <p className="text-sm text-muted">
          Tus entradas y sus códigos QR ya están en tu cuenta. También te enviamos el detalle por
          correo.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/cuenta/entradas">Ver mis entradas</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/eventos">Seguir explorando</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted">
          {formatEventDate(order.event.startsAt)} · {order.event.venueName}
        </p>
      </Shell>
    );
  }

  if (["pending", "awaiting_payment"].includes(order.status)) {
    return (
      <Shell
        icon={<Clock className="size-12 text-amber-400" />}
        title="Estamos confirmando tu pago"
        detail="Esto puede tardar unos segundos."
        refreshSeconds={5}
      >
        <p className="text-sm text-muted">
          No cierres esta página. Tu entrada se emite cuando el proveedor de pagos confirma la
          operación; no antes. Si el cobro no se completa, la reserva se libera y no se te cobra
          nada.
        </p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href={`/checkout/${order.id}`}>Volver al checkout</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      icon={<XCircle className="size-12 text-red-400" />}
      title={order.status === "expired" ? "La reserva venció" : "El pago no se completo"}
      detail={
        order.status === "expired"
          ? "Las entradas volvieron a la venta. No se realizo ningún cargo."
          : "No se realizo ningún cargo. Puedes intentarlo de nuevo."
      }
    >
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href={`/eventos/${order.event.slug}`}>Volver al evento</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/cuenta/compras">Ver mis compras</Link>
        </Button>
      </div>
    </Shell>
  );
}

function Shell({
  icon,
  title,
  detail,
  children,
  refreshSeconds,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  children: React.ReactNode;
  refreshSeconds?: number;
}) {
  return (
    <div className="container flex min-h-[70vh] max-w-lg flex-col items-center justify-center py-14 text-center">
      {refreshSeconds ? (
        // Recarga sencilla sin JavaScript propio: suficiente para una espera corta.
        <meta httpEquiv="refresh" content={String(refreshSeconds)} />
      ) : null}
      {icon}
      <h1 className="text-display mt-4 text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">{detail}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
