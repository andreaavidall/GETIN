"use client";

import { Info, Minus, Plus, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { WaitlistButton } from "@/components/checkout/waitlist-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createOrderAction } from "@/lib/actions/checkout";
import {
  checkTicketAvailability,
  isOnSale,
  remainingTickets,
} from "@/lib/domain/availability";
import { applyBps, computeOrderTotals, DEFAULT_PRICING } from "@/lib/domain/pricing";
import { formatPEN, formatTime } from "@/lib/utils";
import type { TicketTypeView } from "@/types/catalog";

/**
 * Selector de entradas.
 *
 * El total que se muestra aquí es una ESTIMACION para que el comprador vea el
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
  minAge,
  dressCode,
  lastEntryAt,
  waitingTicketTypes = [],
}: {
  eventId: string;
  eventName: string;
  eventSlug: string;
  ticketTypes: TicketTypeView[];
  isAuthenticated: boolean;
  demoMode: boolean;
  minAge: number;
  dressCode?: string | null;
  lastEntryAt?: Date | null;
  /** Tipos de entrada para los que esta persona ya pidió aviso. */
  waitingTicketTypes?: string[];
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
              ? `Máximo ${type.maxPerOrder} por compra`
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
  const totalEntradas = selected.reduce((acc, [, qty]) => acc + qty, 0);
  const desdeCents = sorted.find((t) => isOnSale(t, now))?.priceCents ?? null;

  return (
    <>
    <div id="entradas" className="surface scroll-mt-24 overflow-hidden">
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
          desglosado aquí mismo al elegir, y otra vez antes de pagar.
        </p>
      </div>

      {sorted.length === 0 || !anyOnSale ? (
        <div className="p-5 text-sm text-muted">
          Este evento no tiene venta de entradas online.
          {sorted.length > 0 ? " La venta está cerrada." : null}
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
                    {/* Que incluye, en lista: es lo primero que se pregunta
                        y lo que mas se discute en la puerta. */}
                    {type.includes.length > 0 ? (
                      <ul className="mt-2 space-y-0.5">
                        {type.includes.map((item) => (
                          <li key={item} className="flex gap-1.5 text-xs text-muted">
                            <span className="text-lime">·</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {type.conditions ? (
                      <p className="mt-1 text-xs text-muted/80">{type.conditions}</p>
                    ) : null}
                  </div>

                  <p className="shrink-0 font-display text-base font-bold">
                    {formatPEN(type.priceCents)}
                  </p>
                </div>

                {soldOut && !demoMode ? (
                  <div className="mt-4">
                    <WaitlistButton
                      eventId={eventId}
                      eventSlug={eventSlug}
                      ticketTypeId={type.id}
                      initial={waitingTicketTypes.includes(type.id)}
                      isAuthenticated={isAuthenticated}
                    />
                  </div>
                ) : null}

                {onSale && !soldOut ? (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted">
                      Máximo {type.maxPerOrder} por compra
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
              Inicia sesión para comprar
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

      {/* Condiciones de ingreso y devoluciones JUNTO al botón, no enterradas
          más abajo: son exactamente lo que alguien necesita saber antes de
          pagar, y lo que genera una discusión en la puerta si se descubre
          después. */}
      <div className="space-y-3 border-t border-white/10 bg-white/[0.02] p-5">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Info className="size-3.5 text-lime" />
          Antes de comprar
        </h3>
        <ul className="space-y-1.5 text-xs text-muted">
          <li className="flex gap-2">
            <span className="text-lime">·</span>
            Edad mínima <strong className="text-paper">{minAge} años</strong>. Te pueden pedir
            DNI o carné de extranjería en la puerta.
          </li>
          {dressCode ? (
            <li className="flex gap-2">
              <span className="text-lime">·</span>
              Vestimenta: {dressCode}
            </li>
          ) : null}
          {lastEntryAt ? (
            <li className="flex gap-2">
              <span className="text-lime">·</span>
              Último ingreso a las{" "}
              <strong className="text-paper">{formatTime(lastEntryAt)}</strong>. Después de esa
              hora el local puede no dejarte pasar.
            </li>
          ) : null}
          <li className="flex gap-2">
            <span className="text-lime">·</span>
            Si llegas con tu entrada pagada y el local ya alcanzó su aforo autorizado y no puedes
            entrar, te devolvemos el importe completo.{" "}
            <Link href="/legal/reembolsos" className="text-lime hover:underline">
              Cómo pedir la devolución
            </Link>
            .
          </li>
        </ul>
      </div>
    </div>

    {/* ------------------------------------------- barra inferior en movil ---
        En el celular el panel de compra queda al final de una página larga.
        Esta barra mantiene el total y el boton a la vista. Solo aparece en
        pantallas pequenas; el relleno inferior del layout evita que tape el
        contenido. */}
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 backdrop-blur lg:hidden">
      <div className="container flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          {estimate ? (
            <>
              <p className="text-[11px] text-muted">
                {totalEntradas} {totalEntradas === 1 ? "entrada" : "entradas"} · cargo incluido
              </p>
              <p className="font-display text-lg font-bold leading-tight text-lime">
                {formatPEN(estimate.totalCents)}
              </p>
            </>
          ) : desdeCents !== null ? (
            <>
              <p className="text-[11px] uppercase tracking-wide text-muted">Desde</p>
              <p className="font-display text-lg font-bold leading-tight">
                {formatPEN(desdeCents)}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted">Sin venta de entradas online</p>
          )}
        </div>

        {sorted.length === 0 || !anyOnSale ? (
          // Nada que comprar: ni un boton deshabilitado, que invita a tocarlo.
          <p className="shrink-0 text-xs text-muted">Consulta en el local</p>
        ) : demoMode ? (
          <Button size="sm" disabled className="shrink-0">
            Solo demostración
          </Button>
        ) : !isAuthenticated ? (
          <Button asChild size="sm" className="shrink-0">
            <Link href={`/login?siguiente=/eventos/${eventSlug}`}>Inicia sesión</Link>
          </Button>
        ) : selected.length === 0 ? (
          <Button asChild variant="secondary" size="sm" className="shrink-0">
            <a href="#entradas">Elegir entradas</a>
          </Button>
        ) : (
          <Button size="sm" onClick={buy} disabled={pending} className="shrink-0">
            {pending ? "Reservando..." : "Comprar"}
          </Button>
        )}
      </div>
    </div>
    </>
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
