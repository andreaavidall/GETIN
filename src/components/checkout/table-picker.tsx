"use client";

import { LayoutGrid, Map as MapIcon, Sofa, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { WaitlistButton } from "@/components/checkout/waitlist-button";
import { Disclosure } from "@/components/ui/disclosure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createOrderAction } from "@/lib/actions/checkout";
import { applyBps, DEFAULT_PRICING } from "@/lib/domain/pricing";
import { isTableBookable, tableBalanceDueCents, tableStateLabel } from "@/lib/domain/availability";
import { cn, formatPEN } from "@/lib/utils";
import type { TableView } from "@/types/catalog";

/**
 * Mesas VIP: lista por zona y, si el local colocó sus mesas en el plano,
 * también una vista de plano.
 *
 * El plano solo aparece cuando hay coordenadas de verdad en
 * `venue_tables.position_x/y`. Dibujar un plano inventado sería peor que no
 * tenerlo: la gente elegiría "la mesa junto a la pista" mirando un dibujo que
 * no corresponde al local.
 */
export function TablePicker({
  eventId,
  eventSlug,
  tables,
  isAuthenticated,
  demoMode,
  waitingTables = [],
  source,
}: {
  eventId: string;
  eventSlug: string;
  tables: TableView[];
  isAuthenticated: boolean;
  demoMode: boolean;
  /** Mesas para las que esta persona ya pidió aviso. */
  waitingTables?: string[];
  source?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [vista, setVista] = useState<"lista" | "plano">("lista");
  const now = useMemo(() => new Date(), []);

  // Hay plano solo si TODAS las mesas tienen coordenadas: con la mitad
  // colocadas, el plano miente por omisión.
  const hayPlano =
    tables.length > 0 && tables.every((t) => t.positionX !== null && t.positionY !== null);

  const byZone = useMemo(() => {
    const groups = new Map<string, TableView[]>();
    for (const table of tables) {
      const zone = table.zone ?? "General";
      groups.set(zone, [...(groups.get(zone) ?? []), table]);
    }
    return [...groups.entries()];
  }, [tables]);

  const mesaSeleccionada = tables.find((t) => t.id === selected) ?? null;

  function reserve(table: TableView) {
    startTransition(async () => {
      const result = await createOrderAction({
        eventId,
        tickets: [],
        tableAvailabilityId: table.id,
        source,
      });
      if (!result.ok) {
        toast.error("No se pudo retener la mesa", { description: result.error });
        if (result.code === "table_unavailable") router.refresh();
        return;
      }
      router.push(`/checkout/${result.orderId}`);
    });
  }

  /** La acción que corresponde a cada mesa según su estado y quién mira. */
  function accion(table: TableView, size: "sm" | "lg" = "sm") {
    const bookable = isTableBookable(table, now);

    if (!bookable) {
      return demoMode ? null : (
        <WaitlistButton
          eventId={eventId}
          eventSlug={eventSlug}
          venueTableId={table.venueTableId}
          initial={waitingTables.includes(table.venueTableId)}
          isAuthenticated={isAuthenticated}
          label="Avísame si se libera"
        />
      );
    }

    // Una mesa marcada «Disponible» con un botón apagado que dice «Reserva no
    // disponible» es una contradicción. Si lo único que falta es la sesión, se
    // ofrece iniciarla; si es la demostración, se explica por qué no se puede.
    if (demoMode) {
      return (
        <div>
          <Button full size={size} variant="outline" disabled>
            Reservas no disponibles en la demostración
          </Button>
          <p className="mt-1.5 text-[11px] text-muted">
            Esta instalación usa un catálogo de ejemplo y no admite reservas reales.
          </p>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <Button asChild full size={size}>
          <Link href={`/login?siguiente=${encodeURIComponent(`/eventos/${eventSlug}#mesas`)}`}>
            Inicia sesión para reservar
          </Link>
        </Button>
      );
    }

    return (
      <Button
        full
        size={size}
        disabled={pending}
        onClick={() => {
          setSelected(table.id);
          reserve(table);
        }}
      >
        {pending && selected === table.id ? "Reteniendo..." : "Reservar mesa"}
      </Button>
    );
  }

  return (
    <div className="space-y-5">
      {hayPlano ? (
        <div
          className="flex gap-1 rounded-xl bg-white/5 p-1"
          role="tablist"
          aria-label="Vista de mesas"
        >
          {(["lista", "plano"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                vista === v ? "bg-lime text-ink" : "text-muted hover:text-paper",
              )}
            >
              {v === "lista" ? (
                <LayoutGrid className="size-3.5" />
              ) : (
                <MapIcon className="size-3.5" />
              )}
              {v === "lista" ? "Lista" : "Plano del local"}
            </button>
          ))}
        </div>
      ) : null}

      {/* En el plano, tocar una mesa abre SU panel debajo y el plano sigue a la
          vista con la mesa resaltada. Saltar a la lista hacía perder de golpe
          la referencia de dónde estaba la mesa, que es justo para lo que uno
          abre un plano. */}
      {hayPlano && vista === "plano" ? (
        <div className="space-y-4">
          <TableMap tables={tables} now={now} selected={selected} onSelect={setSelected} />

          {mesaSeleccionada ? (
            <div className="surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Sofa className="size-4 text-lime" />
                    {mesaSeleccionada.label}
                    {mesaSeleccionada.zone ? (
                      <span className="text-xs font-normal text-muted">
                        {mesaSeleccionada.zone}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <Users className="size-3" />
                    Hasta {mesaSeleccionada.capacity} personas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isTableBookable(mesaSeleccionada, now) ? "success" : "outline"}>
                    {tableStateLabel(mesaSeleccionada, now)}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Cerrar detalle de la mesa"
                    className="text-muted hover:text-paper"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <TableFigures table={mesaSeleccionada} />

              {mesaSeleccionada.conditions ? (
                <p className="mt-3 text-[11px] text-muted">{mesaSeleccionada.conditions}</p>
              ) : null}

              <div className="mt-4">{accion(mesaSeleccionada, "lg")}</div>
            </div>
          ) : (
            <p className="text-xs text-muted">
              Toca una mesa del plano para ver sus precios y reservarla.
            </p>
          )}
        </div>
      ) : (
        byZone.map(([zone, zoneTables]) => (
          <div key={zone}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {zone}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {zoneTables.map((table) => {
                const bookable = isTableBookable(table, now);
                const active = selected === table.id;
                return (
                  <div
                    key={table.id}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "rounded-[var(--radius-card)] border bg-surface p-4 transition-all duration-200",
                      active
                        ? "border-lime bg-lime/[0.06] ring-1 ring-lime/40"
                        : bookable
                          ? "border-white/10 hover:border-white/25"
                          : "border-white/[0.07] opacity-70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex flex-wrap items-center gap-x-2 text-base font-semibold">
                        <Sofa className="size-4 shrink-0 text-lime" aria-hidden="true" />
                        {table.label}
                        <span className="text-muted" aria-hidden="true">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-normal text-muted">
                          <Users className="size-3.5" aria-hidden="true" />
                          Hasta {table.capacity} personas
                        </span>
                      </p>
                      {bookable ? null : (
                        <Badge variant="outline">{tableStateLabel(table, now)}</Badge>
                      )}
                    </div>

                    <TableFigures table={table} />

                    {table.conditions ? (
                      <p className="mt-3 text-[11px] text-muted">{table.conditions}</p>
                    ) : null}

                    <div className="mt-4">{accion(table)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

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

/**
 * Las cifras de una mesa, en el orden en que importan.
 *
 * Son cinco números que la gente confunde: lo que cuesta la mesa, lo que paga
 * AHORA en la plataforma (adelanto más el cargo de GETIN), lo que deberá pagar
 * en la puerta, el consumo mínimo —que es ADEMÁS, no parte del precio— y la
 * suma de todo.
 *
 * Esa suma se llama "total mínimo", no "coste de la noche": es un SUELO, no un
 * precio cerrado. Lo que se beba por encima del mínimo se paga aparte, y si la
 * mesa incluye o no el ingreso de los acompañantes lo dicen las condiciones
 * del local, no GETIN. Llamarlo "coste total" prometía algo que nadie puede
 * garantizar desde aquí.
 */
/**
 * Las cifras de una mesa.
 *
 * Arriba, un resumen que se puede comparar de un vistazo entre mesas: lo que
 * se paga ahora, lo que queda para el local y si cubre el ingreso. Debajo, el
 * desglose completo plegado —pero plegado, no escondido: el total minimo y
 * las condiciones obligatorias se ven siempre, abierto o cerrado.
 *
 * Son cinco numeros que la gente confunde, y el total es un SUELO: lo que se
 * beba por encima del minimo se paga aparte.
 */
function TableFigures({ table }: { table: TableView }) {
  const cargo = applyBps(table.depositCents, DEFAULT_PRICING.commissionBps);
  const pagasAhora = table.depositCents + cargo;
  const saldo = tableBalanceDueCents(table);
  const enElLocal = saldo + table.minConsumptionCents;
  const total = pagasAhora + enElLocal;

  return (
    <div className="mt-3 border-t border-white/[0.07] pt-3">
      {/* Resumen comparable */}
      <p className="flex flex-wrap items-baseline gap-x-2 text-base">
        <span className="font-display font-bold text-lime">{formatPEN(pagasAhora)}</span>
        <span className="text-muted">ahora</span>
        <span className="text-muted" aria-hidden="true">
          ·
        </span>
        <span className="font-semibold">{formatPEN(enElLocal)}</span>
        <span className="text-muted">en el local</span>
      </p>

      <p
        className={cn(
          "mt-1.5 text-sm",
          table.includesEntryFor === null
            ? "text-muted"
            : table.includesEntryFor > 0
              ? "text-lime/90"
              : "text-amber-100/85",
        )}
      >
        {table.includesEntryFor === null
          ? "Entradas: el local no lo ha indicado"
          : table.includesEntryFor > 0
            ? `Incluye ingreso para ${table.includesEntryFor} ${
                table.includesEntryFor === 1 ? "persona" : "personas"
              }`
            : "Entradas no incluidas"}
      </p>

      <Disclosure title={`Total mínimo ${formatPEN(total)} · ver desglose`} className="mt-3">
        <dl className="space-y-1.5 text-sm">
          <Fila etiqueta="Precio de la mesa" valor={formatPEN(table.priceCents)} />
          <Fila etiqueta="Adelanto" valor={formatPEN(table.depositCents)} />
          <Fila
            etiqueta={`Cargo por servicio (${(DEFAULT_PRICING.commissionBps / 100).toFixed(0)} %)`}
            valor={formatPEN(cargo)}
          />
          <Fila etiqueta="Pagas ahora aquí" valor={formatPEN(pagasAhora)} destacado />
          <Fila etiqueta="Saldo de la mesa en el local" valor={formatPEN(saldo)} />
          {table.minConsumptionCents > 0 ? (
            <Fila
              etiqueta="Consumo mínimo (aparte)"
              valor={formatPEN(table.minConsumptionCents)}
            />
          ) : null}
          <Fila etiqueta="Pagas en el local" valor={formatPEN(enElLocal)} destacado />
        </dl>

        <p className="mt-3 text-sm text-muted">
          {table.minConsumptionCents > 0 ? (
            <>
              El consumo mínimo <strong className="text-paper">no está incluido</strong> en el
              precio de la mesa: se gasta en barra dentro del local.{" "}
            </>
          ) : null}
          El total es un mínimo, no un precio cerrado: lo que consuman por encima se paga aparte.
          {table.includesEntryFor !== null && table.includesEntryFor > 0 &&
          table.includesEntryFor < table.capacity
            ? ` Si van ${table.capacity}, las ${table.capacity - table.includesEntryFor} restantes compran su entrada aparte.`
            : ""}
          {table.includesEntryFor === null
            ? " Pregunta al local si la mesa cubre el ingreso de tus acompañantes."
            : ""}
        </p>
      </Disclosure>
    </div>
  );
}

function Fila({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        destacado && "border-t border-white/[0.07] pt-1.5 font-semibold",
      )}
    >
      <dt className={destacado ? "" : "text-muted"}>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

/**
 * Plano del local con las mesas colocadas.
 *
 * Las coordenadas son porcentajes del ancho y el alto del salón, tal como las
 * guarda el local. Se dibuja en SVG-libre (posiciones absolutas) para que
 * escale en cualquier pantalla, y cada mesa es un botón de verdad: se puede
 * llegar con el tabulador y leer con un lector de pantalla, que es lo que un
 * plano en imagen no permite.
 *
 * En móvil la etiqueta se abrevia: «Mesa 1» pasa a «1», «Box A» a «A». Con el
 * nombre y el precio dentro, dos mesas que el local colocó a un 15 % de
 * distancia se encimaban a 390 px y no se podían ni leer ni elegir. El nombre
 * completo sigue en el `aria-label`, en el `title` y en el panel de detalle,
 * así que no se pierde nada: solo deja de repetirse «Mesa» cinco veces en un
 * plano donde todo son mesas.
 */
function etiquetaCorta(label: string): string {
  const ultimo = label.trim().split(/\s+/).pop() ?? label;
  // "Mesa 12" -> "12"; "Box A" -> "A"; "Reservado" -> "Re".
  return ultimo.length <= 3 ? ultimo : ultimo.slice(0, 2);
}

function TableMap({
  tables,
  now,
  selected,
  onSelect,
}: {
  tables: TableView[];
  now: Date;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  // Separación mínima entre dos mesas del plano, medida en % del ANCHO del
  // salón (la vertical se convierte con la proporción 4:3 del contenedor).
  // Sirve para que el área táctil crezca hasta donde puede sin pisar a la
  // vecina: un marcador de 22 px es correcto de ver y pequeño de tocar, pero
  // agrandarlo a ciegas haría que tocar "Mesa 2" abriera "Mesa 1".
  const separacion = useMemo(() => {
    let min = 100;
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const a = tables[i]!;
        const b = tables[j]!;
        const dx = (a.positionX ?? 0) - (b.positionX ?? 0);
        const dy = ((a.positionY ?? 0) - (b.positionY ?? 0)) * 0.75;
        min = Math.min(min, Math.hypot(dx, dy));
      }
    }
    return min;
  }, [tables]);

  return (
    <div className="surface p-4">
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-white/[0.03]"
        // `inline-size` habilita las unidades cqw: la separación está en
        // porcentaje del ancho y aquí se vuelve una medida real.
        style={{ containerType: "inline-size" }}
      >
        {/* Referencia fija: dónde está la pista. Sin ella, el plano es una
            nube de puntos sin arriba ni abajo. */}
        <div className="absolute inset-x-6 bottom-4 rounded-lg border border-dashed border-white/15 py-2 text-center text-[10px] uppercase tracking-widest text-muted">
          Pista
        </div>

        {tables.map((table) => {
          const bookable = isTableBookable(table, now);
          const activa = selected === table.id;
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onSelect(table.id)}
              aria-pressed={activa}
              aria-label={`${table.label}${table.zone ? `, ${table.zone}` : ""}. ${tableStateLabel(
                table,
                now,
              )}. Hasta ${table.capacity} personas. ${formatPEN(table.priceCents)}.`}
              style={{
                left: `${table.positionX}%`,
                top: `${table.positionY}%`,
                // Hasta 44 px (el mínimo recomendado para el dedo), pero nunca
                // más que la distancia a la mesa más cercana, y nunca menos
                // que el propio marcador.
                width: `min(2.75rem, ${separacion.toFixed(2)}cqw)`,
                height: `min(2.75rem, ${separacion.toFixed(2)}cqw)`,
                minWidth: "fit-content",
                minHeight: "fit-content",
              }}
              className={cn(
                // Sin `rounded-*`: la caja tactil es invisible y redondearla
                // le quitaba las esquinas, que es justo donde cae el dedo
                // cuando apuntas de lado. El aspecto redondeado lo pone el
                // marcador de dentro.
                "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center",
                activa ? "z-20" : "z-10 hover:z-20 focus-visible:z-20",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none rounded-lg border px-2 py-1 text-center text-[10px] font-semibold leading-tight transition sm:px-2.5 sm:py-1.5 sm:text-[11px]",
                  bookable
                    ? "border-lime/50 bg-lime/15 text-lime"
                    : "border-white/15 bg-white/5 text-muted",
                  activa && "ring-2 ring-lime",
                )}
              >
                {/* El nombre completo y el precio solo caben sin solaparse a
                    partir de pantalla mediana. */}
                <span className="sm:hidden" aria-hidden="true">
                  {etiquetaCorta(table.label)}
                </span>
                <span className="hidden sm:block" aria-hidden="true">
                  {table.label}
                </span>
                <span
                  className="hidden text-[10px] font-normal opacity-80 sm:block"
                  aria-hidden="true"
                >
                  {formatPEN(table.priceCents)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-lime/50 bg-lime/15" />
          Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-white/15 bg-white/5" />
          Reservada o bloqueada
        </span>
        <span className="sm:hidden">
          Toca una mesa para ver su nombre, su precio y reservarla.
        </span>
        <span className="hidden sm:inline">Toca una mesa para ver su precio y reservarla.</span>
      </div>
    </div>
  );
}
