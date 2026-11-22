"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelOrderAction, startPaymentAction } from "@/lib/actions/checkout";

/**
 * Botones del checkout + cuenta atras de la retencion.
 *
 * La cuenta atras es informativa: la verdad la tiene el servidor (`expires_at`),
 * y el barrido `getin_expire_stale_orders` libera el inventario aunque el
 * navegador este cerrado. Cuando llega a cero se recarga la página para que el
 * estado real aparezca.
 */
export function CheckoutActions({
  orderId,
  status,
  expiresAt,
  totalLabel,
  eventSlug,
}: {
  orderId: string;
  status: string;
  expiresAt: string | null;
  totalLabel: string;
  eventSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const left = Math.max(Math.floor((target - Date.now()) / 1000), 0);
      setSecondsLeft(left);
      if (left === 0) router.refresh();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, router]);

  const payable = ["pending", "awaiting_payment", "failed"].includes(status);
  const expired = secondsLeft === 0 || status === "expired";

  function pay() {
    startTransition(async () => {
      const result = await startPaymentAction(orderId);
      if (!result.ok) {
        toast.error("No se pudo iniciar el pago", { description: result.error });
        router.refresh();
        return;
      }
      // Puede ser una URL del proveedor o la pantalla interna del simulador.
      if (result.redirectUrl.startsWith("http")) {
        window.location.assign(result.redirectUrl);
      } else {
        router.push(result.redirectUrl);
      }
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      if (!result.ok) {
        toast.error("No se pudo cancelar", { description: result.error });
        return;
      }
      toast.success("Reserva liberada");
      router.push(`/eventos/${eventSlug}`);
    });
  }

  if (status === "paid") {
    return (
      <div className="mt-5 space-y-3">
        <p className="rounded-xl bg-lime/10 p-3 text-sm text-lime">
          Pago confirmado. Tus entradas ya estan en tu cuenta.
        </p>
        <Button asChild full>
          <Link href="/cuenta/entradas">Ver mis entradas</Link>
        </Button>
      </div>
    );
  }

  if (!payable) {
    return (
      <div className="mt-5 space-y-3">
        <p className="text-sm text-muted">
          Esta orden ya no se puede pagar. Si sigues interesado, vuelve al evento y selecciona de
          nuevo.
        </p>
        <Button asChild full variant="outline">
          <Link href={`/eventos/${eventSlug}`}>Volver al evento</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      {secondsLeft !== null && !expired ? (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] py-2 text-sm">
          <Clock className="size-4 text-lime" />
          <span>
            Tus entradas estan reservadas{" "}
            <strong className="font-mono tabular-nums">
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </strong>
          </span>
        </p>
      ) : null}

      {expired ? (
        <>
          <p className="rounded-xl border border-red-500/30 bg-red-500/[0.08] p-3 text-sm text-red-200">
            La reserva venció y las entradas volvieron a la venta. No se te cobro nada.
          </p>
          <Button asChild full>
            <Link href={`/eventos/${eventSlug}`}>Elegir de nuevo</Link>
          </Button>
        </>
      ) : (
        <>
          <Button full size="lg" onClick={pay} disabled={pending}>
            {pending ? "Conectando con el proveedor..." : `Pagar ${totalLabel}`}
          </Button>
          <Button full variant="ghost" size="sm" onClick={cancel} disabled={pending}>
            Cancelar y liberar la reserva
          </Button>
        </>
      )}
    </div>
  );
}
