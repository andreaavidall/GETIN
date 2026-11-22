import { describe, expect, it } from "vitest";

import {
  applyBps,
  computeOrderTotals,
  DEFAULT_PRICING,
  getinNetCents,
  type LineItemInput,
} from "@/lib/domain/pricing";

/**
 * Precios: es la operacion que decide cuanto se cobra, asi que se prueba el
 * resultado exacto en centimos, no aproximaciones.
 */

const ticket = (price: number, qty: number, id = "t1"): LineItemInput => ({
  refId: id,
  kind: "ticket",
  description: "General",
  unitPriceCents: price,
  quantity: qty,
});

describe("applyBps", () => {
  it("calcula puntos base redondeando al centimo", () => {
    expect(applyBps(10_000, 700)).toBe(700); // 7% de S/100 = S/7
    expect(applyBps(7_000, 700)).toBe(490); // 7% de S/70 = S/4.90
    expect(applyBps(3_333, 700)).toBe(233); // 233.31 -> 233
    expect(applyBps(0, 700)).toBe(0);
  });

  it("rechaza importes que no sean enteros no negativos", () => {
    expect(() => applyBps(10.5, 700)).toThrow(/entero/);
    expect(() => applyBps(-100, 700)).toThrow(/entero/);
  });
});

describe("computeOrderTotals", () => {
  it("suma las lineas y aplica la comision al subtotal", () => {
    const totals = computeOrderTotals([ticket(7_000, 2)], DEFAULT_PRICING);

    expect(totals.subtotalCents).toBe(14_000);
    expect(totals.serviceFeeCents).toBe(980); // 7% de 14000
    expect(totals.totalCents).toBe(14_980);
  });

  it("mantiene la invariante total = subtotal + cargo por servicio", () => {
    const cases: LineItemInput[][] = [
      [ticket(4_500, 1)],
      [ticket(7_000, 3), ticket(15_000, 2, "t2")],
      [ticket(1, 1)],
      [ticket(0, 4)], // entrada gratuita
      [ticket(999_99, 7, "t3")],
    ];

    for (const items of cases) {
      const totals = computeOrderTotals(items);
      expect(totals.totalCents).toBe(totals.subtotalCents + totals.serviceFeeCents);
      // Nunca se cobra menos que el precio del local.
      expect(totals.totalCents).toBeGreaterThanOrEqual(totals.subtotalCents);
      // Al local le corresponde exactamente el precio que fijo.
      expect(totals.venueAmountCents).toBe(totals.subtotalCents);
    }
  });

  it("no cobra cargo por servicio cuando todo es gratuito", () => {
    const totals = computeOrderTotals([ticket(0, 3)]);
    expect(totals.subtotalCents).toBe(0);
    expect(totals.serviceFeeCents).toBe(0);
    expect(totals.totalCents).toBe(0);
  });

  it("devuelve todos los importes como enteros", () => {
    const totals = computeOrderTotals([ticket(3_333, 3)]);
    for (const value of [
      totals.subtotalCents,
      totals.serviceFeeCents,
      totals.taxCents,
      totals.totalCents,
      totals.getinFeeCents,
      totals.gatewayFeeCents,
      totals.venueAmountCents,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("calcula el IGV contenido en el precio del local", () => {
    // S/118 con IGV incluido al 18% -> S/18 de impuesto.
    const totals = computeOrderTotals([ticket(11_800, 1)]);
    expect(totals.taxCents).toBe(1_800);
  });

  it("aplica el cargo fijo por orden una sola vez", () => {
    const totals = computeOrderTotals([ticket(5_000, 2), ticket(5_000, 2, "t2")], {
      ...DEFAULT_PRICING,
      serviceFeeFixedCents: 200,
    });
    // 7% de 20000 = 1400, mas 200 fijos.
    expect(totals.serviceFeeCents).toBe(1_600);
  });

  it("respeta la comision especifica de un local", () => {
    const totals = computeOrderTotals([ticket(10_000, 1)], {
      ...DEFAULT_PRICING,
      commissionBps: 1_200,
    });
    expect(totals.commissionBps).toBe(1_200);
    expect(totals.serviceFeeCents).toBe(1_200);
  });

  it("rechaza cantidades invalidas", () => {
    expect(() => computeOrderTotals([ticket(1_000, 0)])).toThrow(/Cantidad inválida/);
    expect(() => computeOrderTotals([ticket(1_000, -2)])).toThrow(/Cantidad inválida/);
    expect(() => computeOrderTotals([ticket(1_000, 1.5)])).toThrow(/Cantidad inválida/);
  });

  it("rechaza una orden vacia", () => {
    expect(() => computeOrderTotals([])).toThrow(/no tiene conceptos/);
  });

  it("rechaza precios no enteros (centimos fraccionarios)", () => {
    expect(() => computeOrderTotals([ticket(70.5, 1)])).toThrow(/entero/);
  });

  it("separa el coste de pasarela del ingreso de GETIN", () => {
    const totals = computeOrderTotals([ticket(10_000, 1)]);
    // 3.49% de 10700 + S/1 fijo.
    expect(totals.gatewayFeeCents).toBe(applyBps(10_700, 349) + 100);
    expect(getinNetCents(totals)).toBe(totals.getinFeeCents - totals.gatewayFeeCents);
  });

  it("acepta mesas y entradas en la misma orden", () => {
    const totals = computeOrderTotals([
      ticket(7_000, 2),
      { refId: "m1", kind: "table", description: "Mesa 1 (adelanto)", unitPriceCents: 20_000, quantity: 1 },
    ]);
    expect(totals.subtotalCents).toBe(34_000);
    expect(totals.lines).toHaveLength(2);
    expect(totals.lines[1]?.totalCents).toBe(20_000);
  });
});
