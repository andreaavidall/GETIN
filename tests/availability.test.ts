import { describe, expect, it } from "vitest";

import {
  availabilityLabel,
  checkTicketAvailability,
  isOnSale,
  isSoldOut,
  isTableBookable,
  priceFromCents,
  remainingTickets,
  tableBalanceDueCents,
  tableStateLabel,
  type TableAvailabilitySnapshot,
  type TicketTypeSnapshot,
} from "@/lib/domain/availability";

/**
 * Disponibilidad: la regla que impide la sobreventa.
 * La ejecucion atomica vive en Postgres; aqui se prueba la decision.
 */

const NOW = new Date("2026-03-14T20:00:00Z");

function type(overrides: Partial<TicketTypeSnapshot> = {}): TicketTypeSnapshot {
  return {
    id: "tt-1",
    name: "General",
    priceCents: 7_000,
    capacity: 100,
    soldCount: 0,
    heldCount: 0,
    maxPerOrder: 6,
    salesStartAt: null,
    salesEndAt: null,
    isActive: true,
    ...overrides,
  };
}

describe("remainingTickets", () => {
  it("descuenta vendidas y retenidas", () => {
    expect(remainingTickets(type({ capacity: 100, soldCount: 60, heldCount: 10 }))).toBe(30);
  });

  it("nunca devuelve un numero negativo", () => {
    // Estado imposible en la base (hay un CHECK), pero la interfaz no debe romperse.
    expect(remainingTickets(type({ capacity: 10, soldCount: 12, heldCount: 3 }))).toBe(0);
  });

  it("considera agotado cuando lo retenido completa el aforo", () => {
    const t = type({ capacity: 50, soldCount: 40, heldCount: 10 });
    expect(isSoldOut(t)).toBe(true);
  });
});

describe("isOnSale", () => {
  it("respeta la ventana de venta", () => {
    expect(isOnSale(type({ salesStartAt: new Date("2026-03-15T00:00:00Z") }), NOW)).toBe(false);
    expect(isOnSale(type({ salesEndAt: new Date("2026-03-13T00:00:00Z") }), NOW)).toBe(false);
    expect(
      isOnSale(
        type({
          salesStartAt: new Date("2026-03-01T00:00:00Z"),
          salesEndAt: new Date("2026-03-20T00:00:00Z"),
        }),
        NOW,
      ),
    ).toBe(true);
  });

  it("una entrada inactiva nunca esta a la venta", () => {
    expect(isOnSale(type({ isActive: false }), NOW)).toBe(false);
  });
});

describe("checkTicketAvailability", () => {
  it("permite una compra normal", () => {
    const result = checkTicketAvailability(type(), 2, NOW);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.remaining).toBe(100);
  });

  it("impide pedir mas de lo que queda (sobreventa)", () => {
    const t = type({ capacity: 10, soldCount: 8, heldCount: 1 });
    const result = checkTicketAvailability(t, 2, NOW);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("sold_out");
    expect(result.remaining).toBe(1);
  });

  it("permite exactamente la ultima entrada", () => {
    const t = type({ capacity: 10, soldCount: 9 });
    expect(checkTicketAvailability(t, 1, NOW).allowed).toBe(true);
    expect(checkTicketAvailability(t, 2, NOW).allowed).toBe(false);
  });

  it("cuenta las retenciones de otros compradores como no disponibles", () => {
    // Dos personas con la misma ultima entrada: la segunda no puede.
    const t = type({ capacity: 5, soldCount: 4, heldCount: 1 });
    expect(checkTicketAvailability(t, 1, NOW).allowed).toBe(false);
  });

  it("aplica el maximo por compra", () => {
    const result = checkTicketAvailability(type({ maxPerOrder: 4 }), 5, NOW);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("over_max_per_order");
  });

  it("rechaza cantidades invalidas", () => {
    for (const qty of [0, -1, 1.5, Number.NaN]) {
      const result = checkTicketAvailability(type(), qty, NOW);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("invalid_quantity");
    }
  });

  it("distingue venta no iniciada de venta cerrada", () => {
    expect(
      checkTicketAvailability(type({ salesStartAt: new Date("2026-04-01T00:00:00Z") }), 1, NOW).reason,
    ).toBe("sales_not_started");
    expect(
      checkTicketAvailability(type({ salesEndAt: new Date("2026-02-01T00:00:00Z") }), 1, NOW).reason,
    ).toBe("sales_ended");
  });

  it("una entrada agotada manda sobre el maximo por compra", () => {
    const t = type({ capacity: 1, soldCount: 1, maxPerOrder: 1 });
    expect(checkTicketAvailability(t, 1, NOW).reason).toBe("sold_out");
  });

  it("devuelve siempre un mensaje legible", () => {
    const result = checkTicketAvailability(type({ isActive: false }), 1, NOW);
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("availabilityLabel", () => {
  it("marca agotado cuando no queda nada a la venta", () => {
    const label = availabilityLabel([type({ capacity: 10, soldCount: 10 })], NOW);
    expect(label.tone).toBe("soldout");
  });

  it("avisa de ultimas entradas por debajo del 15%", () => {
    const label = availabilityLabel([type({ capacity: 100, soldCount: 90 })], NOW);
    expect(label.tone).toBe("low");
    expect(label.label).toContain("10");
  });

  it("marca venta cerrada si ninguna entrada esta en ventana", () => {
    const label = availabilityLabel(
      [type({ salesEndAt: new Date("2026-01-01T00:00:00Z") })],
      NOW,
    );
    expect(label.tone).toBe("closed");
  });

  it("sin tipos de entrada devuelve venta cerrada", () => {
    expect(availabilityLabel([], NOW).tone).toBe("closed");
  });
});

describe("priceFromCents", () => {
  it("devuelve el precio mas bajo disponible", () => {
    const price = priceFromCents(
      [
        type({ id: "a", priceCents: 7_000 }),
        type({ id: "b", priceCents: 4_500 }),
        type({ id: "c", priceCents: 15_000 }),
      ],
      NOW,
    );
    expect(price).toBe(4_500);
  });

  it("ignora los tipos agotados", () => {
    const price = priceFromCents(
      [
        type({ id: "a", priceCents: 4_500, capacity: 10, soldCount: 10 }),
        type({ id: "b", priceCents: 7_000 }),
      ],
      NOW,
    );
    expect(price).toBe(7_000);
  });

  it("devuelve null si no hay nada a la venta", () => {
    expect(priceFromCents([type({ isActive: false })], NOW)).toBeNull();
    expect(priceFromCents([], NOW)).toBeNull();
  });
});

describe("mesas VIP", () => {
  function table(overrides: Partial<TableAvailabilitySnapshot> = {}): TableAvailabilitySnapshot {
    return {
      id: "tb-1",
      state: "available",
      heldUntil: null,
      priceCents: 60_000,
      depositCents: 20_000,
      minConsumptionCents: 40_000,
      ...overrides,
    };
  }

  it("una mesa libre se puede reservar", () => {
    expect(isTableBookable(table(), NOW)).toBe(true);
  });

  it("una mesa reservada o bloqueada no", () => {
    expect(isTableBookable(table({ state: "reserved" }), NOW)).toBe(false);
    expect(isTableBookable(table({ state: "blocked" }), NOW)).toBe(false);
  });

  it("una retencion vigente bloquea; una vencida libera", () => {
    const vigente = table({ state: "held", heldUntil: new Date("2026-03-14T20:10:00Z") });
    const vencida = table({ state: "held", heldUntil: new Date("2026-03-14T19:50:00Z") });
    expect(isTableBookable(vigente, NOW)).toBe(false);
    expect(isTableBookable(vencida, NOW)).toBe(true);
  });

  it("una retencion sin fecha limite se trata como bloqueada", () => {
    expect(isTableBookable(table({ state: "held", heldUntil: null }), NOW)).toBe(false);
  });

  it("el saldo es el precio menos el adelanto y nunca negativo", () => {
    expect(tableBalanceDueCents(table())).toBe(40_000);
    expect(tableBalanceDueCents(table({ depositCents: 60_000 }))).toBe(0);
    expect(tableBalanceDueCents(table({ depositCents: 90_000 }))).toBe(0);
  });

  it("la etiqueta refleja el estado real tras el vencimiento", () => {
    const vencida = table({ state: "held", heldUntil: new Date("2026-03-14T19:00:00Z") });
    expect(tableStateLabel(vencida, NOW)).toBe("Disponible");
    expect(tableStateLabel(table({ state: "reserved" }), NOW)).toBe("Reservada");
  });
});
