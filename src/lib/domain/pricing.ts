/**
 * Calculo de importes de una orden.
 *
 * Reglas:
 *  - Todo en centimos (enteros). Nada de coma flotante.
 *  - La comisión de GETIN y la del proveedor de pagos se calculan sobre el bruto
 *    y se guardan por separado: la plataforma no asume que el dinero se divida
 *    automaticamente (eso depende del proveedor y del acuerdo comercial).
 *  - El IGV se expone como informativo: el responsable tributario de la venta es
 *    el establecimiento, y la boleta la emite el, no GETIN.
 *
 * Modulo puro y sin dependencias: es el que cubren los tests.
 */

export type LineItemInput = {
  /** Identificador del concepto (tipo de entrada o disponibilidad de mesa). */
  refId: string;
  kind: "ticket" | "table" | "guest_list";
  description: string;
  unitPriceCents: number;
  quantity: number;
};

export type PricingConfig = {
  /** Comisión de GETIN en puntos base. 700 = 7.00% */
  commissionBps: number;
  /** Cargo fijo por orden, en centimos (0 por defecto). */
  serviceFeeFixedCents: number;
  /** IGV en puntos base, informativo. 1800 = 18.00% */
  igvBps: number;
  /** Comisión estimada de la pasarela en puntos base (para la liquidación). */
  gatewayBps?: number;
  /** Cargo fijo de la pasarela por transacción, en centimos. */
  gatewayFixedCents?: number;
};

export type PricedLine = LineItemInput & { totalCents: number };

export type OrderTotals = {
  lines: PricedLine[];
  subtotalCents: number;
  /** Lo que cobra GETIN al comprador por el servicio. */
  serviceFeeCents: number;
  /** IGV informativo incluido en el precio del local. */
  taxCents: number;
  totalCents: number;
  commissionBps: number;
  /** Ingreso de GETIN por esta orden. */
  getinFeeCents: number;
  /** Coste estimado de la pasarela. */
  gatewayFeeCents: number;
  /** Lo que le corresponde al establecimiento. */
  venueAmountCents: number;
};

export const DEFAULT_PRICING: PricingConfig = {
  commissionBps: 700,
  serviceFeeFixedCents: 0,
  igvBps: 1800,
  gatewayBps: 349,
  gatewayFixedCents: 100,
};

/** Multiplica por puntos base redondeando al centimo mas cercano. */
export function applyBps(amountCents: number, bps: number): number {
  assertSafeInt(amountCents, "amountCents");
  return Math.round((amountCents * bps) / 10_000);
}

function assertSafeInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} debe ser un entero no negativo de centimos, recibido: ${value}`);
  }
}

/**
 * Calcula el desglose completo de una orden.
 * Invariante: totalCents === subtotalCents + serviceFeeCents (el IGV ya va dentro
 * del precio del local, como es costumbre en Perú, y se informa aparte).
 */
export function computeOrderTotals(
  items: LineItemInput[],
  config: PricingConfig = DEFAULT_PRICING,
): OrderTotals {
  if (items.length === 0) {
    throw new Error("La orden no tiene conceptos");
  }

  const lines: PricedLine[] = items.map((item) => {
    assertSafeInt(item.unitPriceCents, "unitPriceCents");
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`Cantidad inválida para ${item.description}: ${item.quantity}`);
    }
    return { ...item, totalCents: item.unitPriceCents * item.quantity };
  });

  const subtotalCents = lines.reduce((acc, line) => acc + line.totalCents, 0);

  // Cargo por servicio que paga el comprador = comisión de GETIN + cargo fijo.
  const serviceFeeCents =
    subtotalCents === 0 ? 0 : applyBps(subtotalCents, config.commissionBps) + config.serviceFeeFixedCents;

  const totalCents = subtotalCents + serviceFeeCents;

  // IGV contenido en el precio del local (informativo): precio - precio/(1+igv).
  const taxCents = Math.round(subtotalCents - subtotalCents / (1 + config.igvBps / 10_000));

  const gatewayFeeCents =
    applyBps(totalCents, config.gatewayBps ?? 0) + (config.gatewayFixedCents ?? 0);

  return {
    lines,
    subtotalCents,
    serviceFeeCents,
    taxCents,
    totalCents,
    commissionBps: config.commissionBps,
    getinFeeCents: serviceFeeCents,
    gatewayFeeCents,
    // Al local le corresponde el precio que fijo. El coste de pasarela lo absorbe
    // GETIN en este modelo; cambiar esto es una decisión comercial, no técnica.
    venueAmountCents: subtotalCents,
  };
}

/** Importe libre para GETIN tras pagar la pasarela. */
export function getinNetCents(totals: OrderTotals): number {
  return totals.getinFeeCents - totals.gatewayFeeCents;
}
