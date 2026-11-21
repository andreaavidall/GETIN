"use client";

import { Minus, Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createOrderAction } from "@/lib/actions/checkout";
import {
  checkTicketAvailability,
  isOnSale,
  remainingTickets,
} from "@/lib/domain/availability";
import { applyBps, computeOrderTotals, DEFAULT_PRICING } from "@/lib/domain/pricing";
import { formatPEN } from "@/lib/utils";
import type { TicketTypeView } from "@/types/catalog";

/**
 * Selector de entradas.
 *
 * El total que se muestra aqui es una ESTIMACION para que el comprador vea el
 * cargo por servicio antes de entrar al checkout. El importe real lo recalcula
 * el servidor desde la base de datos al crear la orden: lo que se muestre en
 * pantalla nunca decide lo que se cobra.
 */
export function TicketSelector({
  eventId,
  eventName,
  eventSlug,
  ticketTypes,
  isAuthenticated,
  demoMode,
}: {
  eventId: string;
  eventName: string;
  eventSlug: string;
  ticketTypes: TicketTypeView[];
  isAuthenticated: boolean;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const now = useMemo(() => new Date(), []);
  const sorted = useMemo(
    () => [...ticketTypes].sort((a, b) => a.priceCents - b.priceCents),
    [ticketTypes],
  );

  const selected = Object.entries(quantities).filter(([, qty]) => qty > 0);

  const estimate = useMemo(() => {
    if (selected.length === 0) return null;
    const lines = selected.map(([id, qty]) => {
      const type = ticketTypes.find((t) => t.id === id)!;
      return {
        refId: id,
        kind: "ticket" as const,
        description: type.name,
        unitPriceCents: type.priceCents,
        quantity: qty,
      };
    });
    return computeOrderTotals(lines, DEFAULT_PRICING);
  }, [selected, ticketTypes]);

  function change(type: TicketTypeView, delta: number) {
    setQuantities((prev) => {
      const current = prev[type.id] ?? 0;
      const next = current + delta;
      if (next <= 0) {
        const { [type.id]: _drop, ...rest } = prev;
        return rest;
      }
      const check = checkTicketAvailability(type, next, now);
      if (!check.allowed) {
        toast.error(check.message, {
          description:
            check.reason === "over_max_per_order"
              ? `Maximo ${type.maxPerOrder} por compra`
              : check.reason === "sold_out"
                ? `Quedan ${check.remaining}`
                : undefined,
        });
        return prev;
      }
      return { ...prev, [type.id]: next };
    });
  }

  function buy() {
    if (selected.length === 0) {
      toast.error("Elige al menos una entrada");
      return;
    }
    startTransition(async () => {
      const result = await createOrderAction({
        eventId,
        tickets: selected.map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
      });

      if (!result.ok) {
        toast.error("No se pudo reservar", { description: result.error });
        if (result.code === "sold_out") router.refresh();
        return;
      }
      router.push(`/checkout/${result.orderId}`);
    });
  }

  const anyOnSale = sorted.some((t) => isOnSale(t, now));

  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-white/10 p-5">
        <h2 className="text-display flex items-center gap-2 text-lg">
          <Ticket className="size-4 text-lime" />
          Entradas
        </h2>
        <p className="mt-1 text-xs text-muted">
          Precios por persona, fijados por el local.
        </p>
        {/* El cargo se anuncia ANTES de elegir, no solo al final: quien mira
            los precios debe saber ya lo que va a pagar de mas. */}
        <p className="mt-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muted">
          A estos precios se suma un{" "}
          <strong className="font-semibold text-paper">
            cargo por servicio del {(DEFAULT_PRICING.commissionBps / 100).toFixed(0)}%
          </strong>
          . Por ejemplo, una entrada de {formatPEN(7000)} son{" "}
          {formatPEN(7000 + applyBps(7000, DEFAULT_PRICING.commissionBps))} en total. Lo ves
          desglosado aqui mismo al elegir, y otra vez antes de pagar.
        </p>
      </div>

      {sorted.length === 0 || !anyOnSale ? (
        <div className="p-5 text-sm text-muted">
          Este evento no tiene venta de entradas online.
          {sorted.length > 0 ? " La venta esta cerrada." : null}
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {sorted.map((type) => {
            const onSale = isOnSale(type, now);
            const remaining = remainingTickets(type);
            const qty = quantities[type.id] ?? 0;
            const soldOut = remaining === 0;

            return (
              <li key={type.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{type.name}</p>
                      {soldOut ? (
                        <Badge variant="danger">Agotado</Badge>
                      ) : remaining <= 10 ? (
                        <Badge variant="warning">Quedan {remaining}</Badge>
                      ) : null}
                      {!onSale && !soldOut ? (
                        <Badge variant="outline">
                          {type.salesStartAt && type.salesStartAt > now
                            ? "Proximamente"
                            : "Venta cerrada"}
                        </Badge>
                      ) : null}
                    </div>
                    {type.description ? (
                      <p className="mt-1 text-xs text-muted">{type.description}</p>
                    ) : null}
                    {type.conditions ? (
                      <p className="mt-1 text-xs text-muted/80">{type.conditions}</p>
                    ) : null}
                  </div>

                  <p className="shrink-0 font-display text-base font-bold">
                    {formatPEN(type.priceCents)}
                  </p>
                </div>

                {onSale && !soldOut ? (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted">
                      Maximo {type.maxPerOrder} por compra
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => change(type, -1)}
                        disabled={qty === 0 || pending}
                        aria-label={`Quitar una entrada ${type.name}`}
                        className="size-9"
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span
                        className="w-9 text-center font-display text-base font-bold"
                        aria-live="polite"
                        aria-label={`${qty} entradas ${type.name}`}
                      >
                        {qty}
                      </span>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => change(type, 1)}
                        disabled={pending}
                        aria-label={`Agregar una entrada ${type.name}`}
                        className="size-9"
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {estimate ? (
        <div className="space-y-2 border-t border-white/10 bg-white/[0.02] p-5 text-sm">
          <Row label="Subtotal" value={formatPEN(estimate.subtotalCents)} />
          <Row
            label={`Cargo por servicio (${(estimate.commissionBps / 100).toFixed(2)}%)`}
            value={formatPEN(estimate.serviceFeeCents)}
            muted
          />
          <div className="flex items-center justify-between border-t border-white/10 pt-2">
            <span className="font-medium">Total estimado</span>
            <span className="font-display text-xl font-bold text-lime">
              {formatPEN(estimate.totalCents)}
            </span>
          </div>
          <p className="text-[11px] text-muted">
            Incluye IGV cuando corresponda. El importe definitivo se confirma en el checkout.
          </p>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-white/10 p-5">
        {demoMode ? (
          <>
            <Button full disabled>
              Compra deshabilitada en modo demo
            </Button>
            <p className="text-xs text-muted">
              Este evento es ficticio. Configura Supabase y un proveedor de pagos para habilitar la
              compra real.
            </p>
          </>
        ) : !isAuthenticated ? (
          <Button asChild full>
            <Link href={`/login?siguiente=/eventos/${eventSlug}`}>
              Inicia sesion para comprar
            </Link>
          </Button>
        ) : (
          <Button full onClick={buy} disabled={pending || selected.length === 0}>
            {pending ? "Reservando..." : "Comprar entrada"}
          </Button>
        )}

        <p className="text-[11px] text-muted">
          Al continuar reservamos tus entradas unos minutos para que completes el pago. Si no
          pagas, vuelven a la venta. {eventName} es un evento del local organizador; GETIN
          intermedia la venta.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted" : ""}>{label}</span>
      <span className={muted ? "text-muted" : ""}>{value}</span>
    </div>
  );
}
