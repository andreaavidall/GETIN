/**
 * Disponibilidad de entradas y mesas.
 *
 * Este modulo decide *si* una compra es admisible y por que no lo es. La
 * ejecucion atomica (bloqueo de fila, incremento de contadores) vive en las
 * funciones de Postgres de `supabase/migrations/..._functions.sql`; aqui esta la
 * misma regla expresada de forma pura para poder probarla y para dar mensajes
 * utiles en la interfaz antes de llamar a la base.
 */

export type TicketTypeSnapshot = {
  id: string;
  name: string;
  priceCents: number;
  capacity: number;
  soldCount: number;
  heldCount: number;
  maxPerOrder: number;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  isActive: boolean;
};

export type AvailabilityReason =
  | "ok"
  | "inactive"
  | "sales_not_started"
  | "sales_ended"
  | "sold_out"
  | "over_max_per_order"
  | "invalid_quantity";

export type AvailabilityCheck = {
  allowed: boolean;
  reason: AvailabilityReason;
  /** Entradas que quedan realmente a la venta. */
  remaining: number;
  message: string;
};

const MESSAGES: Record<AvailabilityReason, string> = {
  ok: "Disponible",
  inactive: "Esta entrada no esta a la venta",
  sales_not_started: "La venta aun no ha comenzado",
  sales_ended: "La venta ya cerro",
  sold_out: "Agotado",
  over_max_per_order: "Supera el maximo por compra",
  invalid_quantity: "Cantidad invalida",
};

/** Entradas libres = aforo - vendidas - retenidas. Nunca negativo. */
export function remainingTickets(type: TicketTypeSnapshot): number {
  return Math.max(type.capacity - type.soldCount - type.heldCount, 0);
}

export function isSoldOut(type: TicketTypeSnapshot): boolean {
  return remainingTickets(type) === 0;
}

/** ¿La venta esta abierta en este instante? */
export function isOnSale(type: TicketTypeSnapshot, now: Date = new Date()): boolean {
  if (!type.isActive) return false;
  if (type.salesStartAt && now < type.salesStartAt) return false;
  if (type.salesEndAt && now > type.salesEndAt) return false;
  return true;
}

export function checkTicketAvailability(
  type: TicketTypeSnapshot,
  quantity: number,
  now: Date = new Date(),
): AvailabilityCheck {
  const remaining = remainingTickets(type);
  const fail = (reason: AvailabilityReason): AvailabilityCheck => ({
    allowed: false,
    reason,
    remaining,
    message: MESSAGES[reason],
  });

  if (!Number.isInteger(quantity) || quantity <= 0) return fail("invalid_quantity");
  if (!type.isActive) return fail("inactive");
  if (type.salesStartAt && now < type.salesStartAt) return fail("sales_not_started");
  if (type.salesEndAt && now > type.salesEndAt) return fail("sales_ended");
  if (remaining === 0) return fail("sold_out");
  if (quantity > type.maxPerOrder) return fail("over_max_per_order");
  if (quantity > remaining) return fail("sold_out");

  return { allowed: true, reason: "ok", remaining, message: MESSAGES.ok };
}

/** Etiqueta corta para la tarjeta del evento. */
export function availabilityLabel(types: TicketTypeSnapshot[], now: Date = new Date()): {
  tone: "available" | "low" | "soldout" | "closed";
  label: string;
} {
  const onSale = types.filter((t) => isOnSale(t, now));
  if (onSale.length === 0) {
    return { tone: "closed", label: "Venta cerrada" };
  }
  const remaining = onSale.reduce((acc, t) => acc + remainingTickets(t), 0);
  if (remaining === 0) return { tone: "soldout", label: "Agotado" };

  const capacity = onSale.reduce((acc, t) => acc + t.capacity, 0);
  if (capacity > 0 && remaining / capacity <= 0.15) {
    return { tone: "low", label: `Ultimas ${remaining}` };
  }
  return { tone: "available", label: "Disponible" };
}

/** Precio mas bajo entre las entradas a la venta, en centimos. */
export function priceFromCents(types: TicketTypeSnapshot[], now: Date = new Date()): number | null {
  const prices = types.filter((t) => isOnSale(t, now) && !isSoldOut(t)).map((t) => t.priceCents);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

// ----------------------------------------------------------------- mesas ----

export type TableAvailabilitySnapshot = {
  id: string;
  state: "available" | "held" | "reserved" | "blocked";
  heldUntil: Date | null;
  priceCents: number;
  depositCents: number;
  minConsumptionCents: number;
};

/**
 * Una mesa retenida cuyo plazo vencio vuelve a estar libre: la verdad la fija
 * `getin_hold_table`, pero la interfaz debe mostrar lo mismo.
 */
export function isTableBookable(
  table: TableAvailabilitySnapshot,
  now: Date = new Date(),
): boolean {
  if (table.state === "available") return true;
  if (table.state === "held") return table.heldUntil !== null && table.heldUntil <= now;
  return false;
}

export function tableStateLabel(
  table: TableAvailabilitySnapshot,
  now: Date = new Date(),
): string {
  if (isTableBookable(table, now)) return "Disponible";
  switch (table.state) {
    case "held":
      return "Retenida";
    case "reserved":
      return "Reservada";
    case "blocked":
      return "No disponible";
    default:
      return "No disponible";
  }
}

/** Saldo que el cliente paga en el local despues del adelanto. */
export function tableBalanceDueCents(table: TableAvailabilitySnapshot): number {
  return Math.max(table.priceCents - table.depositCents, 0);
}
