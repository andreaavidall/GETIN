import "server-only";

import { recordAudit } from "@/lib/audit";
import { checkTicketAvailability, isTableBookable } from "@/lib/domain/availability";
import { computeOrderTotals, type LineItemInput, type PricingConfig } from "@/lib/domain/pricing";
import { createQrCredential } from "@/lib/domain/qr";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { readableCode } from "@/lib/utils";
import type { CartInput } from "@/lib/validation/schemas";

/**
 * Servicio de ordenes.
 *
 * Todo lo que toca dinero o inventario pasa por aquí, en el servidor, con la
 * service role, y SIEMPRE recalculando los precios desde `ticket_types`. Nunca
 * se confia en un importe que venga del navegador.
 *
 * El inventario no se "comprueba y luego se escribe" desde JavaScript: se pide
 * a Postgres con `getin_hold_tickets`, que bloquea la fila y decide. Si dos
 * personas piden la última entrada a la vez, una de las dos recibe SOLD_OUT.
 */

export class OrderError extends Error {
  constructor(
    message: string,
    readonly code:
      | "event_unavailable"
      | "empty_cart"
      | "sold_out"
      | "table_unavailable"
      | "limit_exceeded"
      | "demo_mode"
      | "internal",
    readonly status = 400,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export type CreatedOrder = {
  orderId: string;
  code: string;
  totalCents: number;
  expiresAt: string | null;
};

type TableAvailabilityRow = {
  id: string;
  state: "available" | "held" | "reserved" | "blocked";
  price_cents: number;
  deposit_cents: number;
  min_consumption_cents: number;
  held_until: string | null;
  event_id: string;
  venue_tables: { label: string } | null;
};

type TicketTypeRow = {
  id: string;
  name: string;
  price_cents: number;
  capacity: number;
  sold_count: number;
  held_count: number;
  max_per_order: number;
  sales_start_at: string | null;
  sales_end_at: string | null;
  is_active: boolean;
  event_id: string;
};

async function pricingConfig(venueCommissionBps: number | null): Promise<PricingConfig> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("default_commission_bps, igv_bps, service_fee_fixed_cents")
    .eq("id", 1)
    .maybeSingle();

  const fallback = serverEnv().GETIN_DEFAULT_COMMISSION_BPS;
  return {
    commissionBps: venueCommissionBps ?? (data?.default_commission_bps as number | undefined) ?? fallback,
    igvBps: (data?.igv_bps as number | undefined) ?? 1800,
    serviceFeeFixedCents: (data?.service_fee_fixed_cents as number | undefined) ?? 0,
    gatewayBps: 349,
    gatewayFixedCents: 100,
  };
}

/**
 * Crea una orden en estado `pending` y retiene el inventario.
 * La orden todavia no vende nada: vence sola si no se paga.
 */
export async function createOrderFromCart(
  cart: CartInput,
  buyer: { userId: string; email: string; name: string | null; phone: string | null },
): Promise<CreatedOrder> {
  if (cart.tickets.length === 0 && !cart.tableAvailabilityId) {
    throw new OrderError("No seleccionaste entradas ni mesa", "empty_cart");
  }

  const admin = createSupabaseAdminClient();

  // 1. El evento tiene que estar publicado y el local aprobado.
  const { data: event } = await admin
    .from("events")
    .select(
      `id, name, slug, status, starts_at, min_age, venue_id,
       venues!inner (id, name, status, commission_bps)`,
    )
    .eq("id", cart.eventId)
    .maybeSingle();

  const venue = (event?.venues ?? null) as
    | { id: string; name: string; status: string; commission_bps: number | null }
    | null;

  if (!event || event.status !== "published" || !venue || venue.status !== "approved") {
    throw new OrderError("Este evento no esta disponible para la compra", "event_unavailable", 404);
  }

  const lines: LineItemInput[] = [];

  // 2. Precios y disponibilidad desde la base, no desde el cliente.
  if (cart.tickets.length > 0) {
    const ids = cart.tickets.map((t) => t.ticketTypeId);
    const { data: types } = await admin
      .from("ticket_types")
      .select(
        `id, name, price_cents, capacity, sold_count, held_count, max_per_order,
         sales_start_at, sales_end_at, is_active, event_id`,
      )
      .in("id", ids);

    const rows = (types ?? []) as unknown as TicketTypeRow[];
    if (rows.length !== ids.length) {
      throw new OrderError("Alguna entrada ya no existe", "event_unavailable", 404);
    }

    for (const item of cart.tickets) {
      const row = rows.find((r) => r.id === item.ticketTypeId);
      if (!row) throw new OrderError("Entrada no encontrada", "event_unavailable", 404);
      if (row.event_id !== cart.eventId) {
        throw new OrderError("La entrada no pertenece a este evento", "event_unavailable");
      }

      const check = checkTicketAvailability(
        {
          id: row.id,
          name: row.name,
          priceCents: Number(row.price_cents),
          capacity: row.capacity,
          soldCount: row.sold_count,
          heldCount: row.held_count,
          maxPerOrder: row.max_per_order,
          salesStartAt: row.sales_start_at ? new Date(row.sales_start_at) : null,
          salesEndAt: row.sales_end_at ? new Date(row.sales_end_at) : null,
          isActive: row.is_active,
        },
        item.quantity,
      );

      if (!check.allowed) {
        throw new OrderError(
          `${row.name}: ${check.message}`,
          check.reason === "over_max_per_order" ? "limit_exceeded" : "sold_out",
          409,
        );
      }

      lines.push({
        refId: row.id,
        kind: "ticket",
        description: row.name,
        unitPriceCents: Number(row.price_cents),
        quantity: item.quantity,
      });
    }
  }

  // 3. Mesa VIP, si la hay.
  let tableRow: TableAvailabilityRow | null = null;

  if (cart.tableAvailabilityId) {
    const { data } = await admin
      .from("event_table_availability")
      .select(
        `id, state, price_cents, deposit_cents, min_consumption_cents, held_until, event_id,
         venue_tables!inner (label)`,
      )
      .eq("id", cart.tableAvailabilityId)
      .maybeSingle();

    tableRow = (data ?? null) as TableAvailabilityRow | null;
    if (!tableRow || tableRow.event_id !== cart.eventId) {
      throw new OrderError("Esa mesa no existe para este evento", "table_unavailable", 404);
    }
    const bookable = isTableBookable({
      id: tableRow.id,
      state: tableRow.state,
      heldUntil: tableRow.held_until ? new Date(tableRow.held_until) : null,
      priceCents: Number(tableRow.price_cents),
      depositCents: Number(tableRow.deposit_cents),
      minConsumptionCents: Number(tableRow.min_consumption_cents),
    });
    if (!bookable) {
      throw new OrderError("Esa mesa ya no esta disponible", "table_unavailable", 409);
    }

    // Se cobra el adelanto; el saldo se abona en el local.
    // La etiqueta de la mesa ya suele incluir la palabra "Mesa" ("Mesa 1",
    // "Box A"), así que no se antepone otra.
    const tableLabel = tableRow.venue_tables?.label?.trim() ?? "";
    lines.push({
      refId: tableRow.id,
      kind: "table",
      description: tableLabel ? `${tableLabel} (adelanto)` : "Mesa (adelanto)",
      unitPriceCents: Number(tableRow.deposit_cents),
      quantity: 1,
    });
  }

  // 4. Importes.
  const totals = computeOrderTotals(lines, await pricingConfig(venue.commission_bps));
  const code = `GETIN-${readableCode(6)}`;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      code,
      user_id: buyer.userId,
      event_id: cart.eventId,
      venue_id: venue.id,
      status: "pending",
      subtotal_cents: totals.subtotalCents,
      service_fee_cents: totals.serviceFeeCents,
      tax_cents: totals.taxCents,
      total_cents: totals.totalCents,
      commission_bps: totals.commissionBps,
      getin_fee_cents: totals.getinFeeCents,
      gateway_fee_cents: totals.gatewayFeeCents,
      venue_amount_cents: totals.venueAmountCents,
      buyer_name: buyer.name,
      buyer_email: buyer.email,
      buyer_phone: buyer.phone,
      source: cart.source ?? null,
      idempotency_key: `${buyer.userId}:${code}`,
    })
    .select("id, code, total_cents")
    .single();

  if (orderError || !order) {
    throw new OrderError(`No se pudo crear la orden: ${orderError?.message}`, "internal", 500);
  }

  const orderId = order.id as string;

  try {
    await admin.from("order_items").insert(
      totals.lines.map((line) => ({
        order_id: orderId,
        kind: line.kind,
        ticket_type_id: line.kind === "ticket" ? line.refId : null,
        table_availability_id: line.kind === "table" ? line.refId : null,
        guest_list_id: line.kind === "guest_list" ? line.refId : null,
        description: line.description,
        quantity: line.quantity,
        unit_price_cents: line.unitPriceCents,
        total_cents: line.totalCents,
      })),
    );

    // 5. Retencion atomica. Si falla, no hay sobreventa: no se vendio nada.
    for (const item of cart.tickets) {
      const { error } = await admin.rpc("getin_hold_tickets", {
        p_order_id: orderId,
        p_ticket_type_id: item.ticketTypeId,
        p_qty: item.quantity,
        p_minutes: null,
      });
      if (error) {
        throw new OrderError(
          error.message.includes("SOLD_OUT")
            ? "Alguien se adelanto: ya no quedan suficientes entradas"
            : `No se pudo reservar el inventario: ${error.message}`,
          "sold_out",
          409,
        );
      }
    }

    if (tableRow) {
      const { error } = await admin.rpc("getin_hold_table", {
        p_order_id: orderId,
        p_availability_id: tableRow.id,
        p_minutes: null,
      });
      if (error) {
        throw new OrderError("Esa mesa acaba de ser tomada", "table_unavailable", 409);
      }
    }
  } catch (error) {
    // Deshace la retencion y deja la orden cancelada, no colgada.
    await admin.rpc("getin_release_hold", { p_order_id: orderId });
    await admin
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", orderId);
    throw error;
  }

  const { data: fresh } = await admin
    .from("orders")
    .select("expires_at")
    .eq("id", orderId)
    .maybeSingle();

  await recordAudit({
    action: "order.create",
    entity: "orders",
    entityId: orderId,
    actorId: buyer.userId,
    venueId: venue.id,
    metadata: { code, total_cents: totals.totalCents, lines: totals.lines.length },
  });

  return {
    orderId,
    code: order.code as string,
    totalCents: Number(order.total_cents),
    expiresAt: (fresh?.expires_at as string | null) ?? null,
  };
}

/**
 * Recalcula el importe de la orden desde sus conceptos y lo compara con el
 * guardado. Es la última red antes de cobrar: si algo manipulo la fila, no se
 * inicia el pago.
 */
export async function assertOrderAmountIntact(orderId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("total_cents, subtotal_cents, service_fee_cents, tax_cents, commission_bps")
    .eq("id", orderId)
    .single();
  const { data: items } = await admin
    .from("order_items")
    .select("total_cents")
    .eq("order_id", orderId);

  if (!order || !items) throw new OrderError("Orden no encontrada", "internal", 404);

  const subtotal = items.reduce((acc, i) => acc + Number(i.total_cents), 0);
  const expectedTotal = subtotal + Number(order.service_fee_cents);

  if (subtotal !== Number(order.subtotal_cents) || expectedTotal !== Number(order.total_cents)) {
    throw new OrderError(
      "Los importes de la orden no cuadran con sus conceptos. No se inicio el cobro.",
      "internal",
      409,
    );
  }
  return Number(order.total_cents);
}

/** Cancela una orden del usuario y libera el inventario retenido. */
export async function cancelOrder(orderId: string, userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.user_id !== userId) {
    throw new OrderError("Orden no encontrada", "internal", 404);
  }
  if (order.status === "paid") {
    throw new OrderError(
      "Esta orden ya esta pagada. Para recuperar el importe hay que pedir un reembolso.",
      "internal",
      409,
    );
  }

  await admin.rpc("getin_release_hold", { p_order_id: orderId });
  await admin
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", orderId);

  await recordAudit({
    action: "order.cancel",
    entity: "orders",
    entityId: orderId,
    actorId: userId,
  });
}

/**
 * Confirma una orden pagada: emite entradas y credenciales QR.
 * La llama UNICAMENTE el manejador de webhooks, tras validar la firma.
 * Es idempotente: repetirla no duplica entradas.
 */
export async function confirmPaidOrder(input: {
  orderId: string;
  paymentId: string | null;
}): Promise<{ ticketCount: number; alreadyConfirmed: boolean }> {
  const admin = createSupabaseAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, status, venue_id, user_id, code")
    .eq("id", input.orderId)
    .maybeSingle();

  if (!order) throw new OrderError("Orden no encontrada", "internal", 404);
  if (order.status === "paid") {
    const { count } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("order_id", input.orderId);
    return { ticketCount: count ?? 0, alreadyConfirmed: true };
  }

  // Cuantas credenciales QR hay que generar: una por entrada + una por mesa.
  const { data: items } = await admin
    .from("order_items")
    .select("kind, quantity")
    .eq("order_id", input.orderId);

  const ticketCount = (items ?? [])
    .filter((i) => i.kind === "ticket")
    .reduce((acc, i) => acc + Number(i.quantity), 0);
  const tableCount = (items ?? []).filter((i) => i.kind === "table").length;

  const secret = serverEnv().QR_TOKEN_SECRET;
  // El id real del ticket aún no existe; el nonce no depende de el, y el token
  // definitivo se reconstruye al mostrarlo. Lo que importa aquí es que el nonce
  // y su hash los genere el servidor con el secreto, no la base de datos.
  const credentials = Array.from({ length: ticketCount + tableCount }, () => {
    const cred = createQrCredential("ticket", crypto.randomUUID(), secret);
    return { nonce: cred.nonce, token_hash: cred.tokenHash, token_prefix: cred.tokenPrefix };
  });

  const { data, error } = await admin.rpc("getin_confirm_order", {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    p_credentials: credentials,
  });

  if (error) {
    throw new OrderError(`No se pudo confirmar la orden: ${error.message}`, "internal", 500);
  }

  // Las credenciales se emitieron con un id provisional: ahora que las entradas
  // existen, se vuelven a sellar contra su ticket real.
  await resealCredentials(input.orderId);

  await recordAudit({
    action: "payment.confirm",
    entity: "orders",
    entityId: input.orderId,
    actorId: order.user_id as string,
    venueId: order.venue_id as string,
    metadata: { code: order.code, tickets: Array.isArray(data) ? data.length : ticketCount },
  });

  return { ticketCount: Array.isArray(data) ? data.length : ticketCount, alreadyConfirmed: false };
}

/**
 * Vuelve a calcular token_hash de cada credencial usando el id definitivo del
 * objeto (entrada o reserva) y el nonce ya guardado. Después de esto, el QR que
 * ve el usuario y el hash que válida la puerta coinciden.
 */
async function resealCredentials(orderId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const secret = serverEnv().QR_TOKEN_SECRET;

  const { data: creds } = await admin
    .from("qr_credentials")
    .select("id, nonce, ticket_id, reservation_id, tickets!inner(order_id)")
    .eq("tickets.order_id", orderId);

  for (const cred of (creds ?? []) as { id: string; nonce: string; ticket_id: string | null }[]) {
    if (!cred.ticket_id) continue;
    const sealed = createQrCredential("ticket", cred.ticket_id, secret, cred.nonce);
    await admin
      .from("qr_credentials")
      .update({ token_hash: sealed.tokenHash, token_prefix: sealed.tokenPrefix })
      .eq("id", cred.id);
  }

  const { data: resCreds } = await admin
    .from("qr_credentials")
    .select("id, nonce, reservation_id, table_reservations!inner(order_id)")
    .eq("table_reservations.order_id", orderId);

  for (const cred of (resCreds ?? []) as { id: string; nonce: string; reservation_id: string | null }[]) {
    if (!cred.reservation_id) continue;
    const sealed = createQrCredential("reservation", cred.reservation_id, secret, cred.nonce);
    await admin
      .from("qr_credentials")
      .update({ token_hash: sealed.tokenHash, token_prefix: sealed.tokenPrefix })
      .eq("id", cred.id);
  }
}
