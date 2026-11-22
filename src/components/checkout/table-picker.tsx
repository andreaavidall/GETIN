"use client";

import { Sofa, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createOrderAction } from "@/lib/actions/checkout";
import { isTableBookable, tableBalanceDueCents, tableStateLabel } from "@/lib/domain/availability";
import { formatPEN } from "@/lib/utils";
import type { TableView } from "@/types/catalog";

/**
 * Listado de mesas VIP.
 *
 * El mapa visual del local queda para una fase posterior (las coordenadas ya
 * estan en `venue_tables.position_x/y`): para el MVP, una lista agrupada por
 * zona es mas clara en movil y no necesita que cada local dibuje su plano.
 */
export function TablePicker({
  eventId,
  eventSlug,
  tables,
  isAuthenticated,
  demoMode,
}: {
  eventId: string;
  eventSlug: string;
  tables: TableView[];
  isAuthenticated: boolean;
  demoMode: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const byZone = useMemo(() => {
    const groups = new Map<string, TableView[]>();
    for (const table of tables) {
      const zone = table.zone ?? "General";
      groups.set(zone, [...(groups.get(zone) ?? []), table]);
    }
    return [...groups.entries()];
  }, [tables]);

  function reserve(table: TableView) {
    startTransition(async () => {
      const result = await createOrderAction({
        eventId,
        tickets: [],
        tableAvailabilityId: table.id,
      });
      if (!result.ok) {
        toast.error("No se pudo retener la mesa", { description: result.error });
        if (result.code === "table_unavailable") router.refresh();
        return;
      }
      router.push(`/checkout/${result.orderId}`);
    });
  }

  return (
    <div className="space-y-5">
      {byZone.map(([zone, zoneTables]) => (
        <div key={zone}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{zone}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {zoneTables.map((table) => {
              const bookable = isTableBookable(table, now);
              const active = selected === table.id;
              return (
                <div
                  key={table.id}
                  className={`surface p-4 transition-colors ${
                    active ? "border-lime/60" : bookable ? "surface-hover" : "opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <Sofa className="size-4 text-lime" />
                        {table.label}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <Users className="size-3" />
                        Hasta {table.capacity} personas
                      </p>
                    </div>
                    <Badge variant={bookable ? "success" : "outline"}>
                      {tableStateLabel(table, now)}
                    </Badge>
                  </div>

                  {/* Tres cifras que la gente confunde: lo que cuesta la mesa,
                      lo que paga ahora y lo que debera pagar en la puerta. El
                      consumo mínimo es ADEMAS, no parte del precio: decirlo mal
                      acaba en una discusion con el local. */}
                  <dl className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted">Precio de la mesa</dt>
                      <dd className="font-medium">{formatPEN(table.priceCents)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Pagas ahora (adelanto)</dt>
                      <dd className="font-semibold text-lime">{formatPEN(table.depositCents)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Saldo de la mesa en el local</dt>
                      <dd>{formatPEN(tableBalanceDueCents(table))}</dd>
                    </div>
                    {table.minConsumptionCents > 0 ? (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-muted">
                            Consumo mínimo <span className="text-muted/70">(aparte)</span>
                          </dt>
                          <dd>{formatPEN(table.minConsumptionCents)}</dd>
                        </div>
                        <div className="flex justify-between border-t border-white/5 pt-1.5">
                          <dt className="font-medium">Total a pagar en el local</dt>
                          <dd className="font-semibold">
                            {formatPEN(tableBalanceDueCents(table) + table.minConsumptionCents)}
                          </dd>
                        </div>
                      </>
                    ) : null}
                  </dl>

                  {table.minConsumptionCents > 0 ? (
                    <p className="mt-2 rounded-lg bg-amber-400/[0.07] px-3 py-2 text-[11px] text-amber-100/80">
                      El consumo mínimo <strong className="font-semibold">no está incluido</strong>{" "}
                      en el precio de la mesa: se gasta en barra dentro del local.
                    </p>
                  ) : null}

                  {table.conditions ? (
                    <p className="mt-3 text-[11px] text-muted">{table.conditions}</p>
                  ) : null}

                  {/* Una mesa marcada «Disponible» con un boton apagado que
                      dice «Reserva no disponible» es una contradiccion. Si lo
                      único que falta es la sesión, se ofrece iniciarla; si es
                      la demo, se explica por que no se puede reservar. */}
                  {bookable ? (
                    demoMode ? (
                      <div className="mt-4">
                        <Button full size="sm" variant="outline" disabled>
                          Reservas no disponibles en la demostración
                        </Button>
                        <p className="mt-1.5 text-[11px] text-muted">
                          Esta instalación usa un catálogo de ejemplo y no admite reservas reales.
                        </p>
                      </div>
                    ) : !isAuthenticated ? (
                      <Button asChild full size="sm" className="mt-4">
                        <Link href={`/login?siguiente=${encodeURIComponent(`/eventos/${eventSlug}#mesas`)}`}>
                          Inicia sesión para reservar
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        full
                        size="sm"
                        className="mt-4"
                        disabled={pending}
                        onClick={() => {
                          setSelected(table.id);
                          reserve(table);
                        }}
                      >
                        {pending && active ? "Reteniendo..." : "Reservar mesa"}
                      </Button>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted">
        Al reservar pagas solo el adelanto, al que se suma el cargo por servicio de GETIN. El
        saldo de la mesa y el consumo mínimo se abonan en el local, y el consumo mínimo es
        independiente del precio de la mesa. Una mesa reservada no se vende a nadie más para este
        evento: mientras completas el pago queda retenida unos minutos y, si no pagas, vuelve a
        estar disponible.
      </p>
    </div>
  );
}
