"use client";

import { Sofa, Users } from "lucide-react";
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
  tables,
  canBuy,
}: {
  eventId: string;
  tables: TableView[];
  canBuy: boolean;
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

                  <dl className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted">Precio de la mesa</dt>
                      <dd className="font-medium">{formatPEN(table.priceCents)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Adelanto ahora</dt>
                      <dd className="font-semibold text-lime">{formatPEN(table.depositCents)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Saldo en el local</dt>
                      <dd>{formatPEN(tableBalanceDueCents(table))}</dd>
                    </div>
                    {table.minConsumptionCents > 0 ? (
                      <div className="flex justify-between">
                        <dt className="text-muted">Consumo minimo</dt>
                        <dd>{formatPEN(table.minConsumptionCents)}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {table.conditions ? (
                    <p className="mt-3 text-[11px] text-muted">{table.conditions}</p>
                  ) : null}

                  {bookable ? (
                    canBuy ? (
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
                    ) : (
                      <Button full size="sm" variant="outline" className="mt-4" disabled>
                        Reserva no disponible
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
        Una mesa reservada no se vende a nadie mas para este evento. Mientras completas el pago
        queda retenida unos minutos; si no pagas, vuelve a estar disponible.
      </p>
    </div>
  );
}
