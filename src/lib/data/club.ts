import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Lecturas del panel de discotecas.
 *
 * Usan el cliente con RLS: aunque la consulta filtre por `venue_id`, la base
 * vuelve a comprobar que quien pregunta pertenece a ese local. Dos barreras
 * para el dato mas sensible del panel (ventas e ingresos).
 */

export type VenueSummaryStats = {
  todayGrossCents: number;
  todayOrders: number;
  ticketsSold: number;
  tablesReserved: number;
  guestsConfirmed: number;
  checkins: number;
  grossCents: number;
  getinFeeCents: number;
  netEstimateCents: number;
};

export async function getVenueStats(venueId: string): Promise<VenueSummaryStats> {
  const supabase = await createSupabaseServerClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [paidOrders, todayOrders, tickets, reservations, guests, checkins] = await Promise.all([
    supabase
      .from("orders")
      .select("total_cents, getin_fee_cents, venue_amount_cents")
      .eq("venue_id", venueId)
      .eq("status", "paid"),
    supabase
      .from("orders")
      .select("total_cents")
      .eq("venue_id", venueId)
      .eq("status", "paid")
      .gte("paid_at", startOfToday.toISOString()),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .in("status", ["issued", "used"]),
    supabase
      .from("table_reservations")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .in("status", ["confirmed", "completed"]),
    supabase
      .from("guest_list_entries")
      .select("companions, guest_lists!inner(events!inner(venue_id))", { count: "exact" })
      .eq("guest_lists.events.venue_id", venueId)
      .eq("status", "confirmed"),
    supabase
      .from("checkins")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("result", "granted"),
  ]);

  const rows = (paidOrders.data ?? []) as {
    total_cents: number;
    getin_fee_cents: number;
    venue_amount_cents: number;
  }[];

  const grossCents = rows.reduce((acc, r) => acc + Number(r.total_cents), 0);
  const getinFeeCents = rows.reduce((acc, r) => acc + Number(r.getin_fee_cents), 0);
  const netEstimateCents = rows.reduce((acc, r) => acc + Number(r.venue_amount_cents), 0);

  const todayRows = (todayOrders.data ?? []) as { total_cents: number }[];

  return {
    todayGrossCents: todayRows.reduce((acc, r) => acc + Number(r.total_cents), 0),
    todayOrders: todayRows.length,
    ticketsSold: tickets.count ?? 0,
    tablesReserved: reservations.count ?? 0,
    guestsConfirmed: guests.count ?? 0,
    checkins: checkins.count ?? 0,
    grossCents,
    getinFeeCents,
    netEstimateCents,
  };
}

export type ClubEvent = {
  id: string;
  slug: string;
  name: string;
  status: string;
  startsAt: Date;
  /** Momento programado de publicacion, si el local lo configuro. */
  publishAt: Date | null;
  ticketTypes: {
    id: string;
    name: string;
    priceCents: number;
    capacity: number;
    soldCount: number;
    heldCount: number;
    isActive: boolean;
  }[];
};

export async function listVenueEvents(venueId: string): Promise<ClubEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select(
      `id, slug, name, status, starts_at, publish_at,
       ticket_types (id, name, price_cents, capacity, sold_count, held_count, is_active)`,
    )
    .eq("venue_id", venueId)
    .order("starts_at", { ascending: false })
    .limit(50);

  type Row = {
    id: string;
    slug: string;
    name: string;
    status: string;
    starts_at: string;
    publish_at: string | null;
    ticket_types:
      | {
          id: string;
          name: string;
          price_cents: number;
          capacity: number;
          sold_count: number;
          held_count: number;
          is_active: boolean;
        }[]
      | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    startsAt: new Date(row.starts_at),
    publishAt: row.publish_at ? new Date(row.publish_at) : null,
    ticketTypes: (row.ticket_types ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      priceCents: Number(t.price_cents),
      capacity: t.capacity,
      soldCount: t.sold_count,
      heldCount: t.held_count,
      isActive: t.is_active,
    })),
  }));
}

export type PendingGuestEntry = {
  id: string;
  guestName: string;
  companions: number;
  listName: string;
  eventName: string;
  createdAt: Date;
};

export async function listPendingGuestEntries(venueId: string): Promise<PendingGuestEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("guest_list_entries")
    .select(
      `id, guest_name, companions, created_at,
       guest_lists!inner (name, events!inner (name, venue_id))`,
    )
    .eq("guest_lists.events.venue_id", venueId)
    .eq("status", "pending")
    .order("created_at")
    .limit(50);

  type Row = {
    id: string;
    guest_name: string;
    companions: number;
    created_at: string;
    guest_lists: { name: string; events: { name: string } | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    guestName: row.guest_name,
    companions: row.companions,
    listName: row.guest_lists?.name ?? "",
    eventName: row.guest_lists?.events?.name ?? "",
    createdAt: new Date(row.created_at),
  }));
}

/** Filas para el reporte CSV de asistentes de un evento. */
export async function getEventAttendees(venueId: string, eventId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tickets")
    .select(
      `serial, status, holder_name, used_at, created_at,
       ticket_types!inner (name), orders!inner (code, buyer_email)`,
    )
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .order("created_at");

  type Row = {
    serial: string;
    status: string;
    holder_name: string | null;
    used_at: string | null;
    created_at: string;
    ticket_types: { name: string } | null;
    orders: { code: string; buyer_email: string | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    serial: row.serial,
    type: row.ticket_types?.name ?? "",
    status: row.status,
    holder: row.holder_name ?? "",
    buyerEmail: row.orders?.buyer_email ?? "",
    orderCode: row.orders?.code ?? "",
    usedAt: row.used_at,
    createdAt: row.created_at,
  }));
}

/**
 * Qué enlaces traen compras.
 *
 * Se agrupa por la etiqueta que venía en `?ref=`, que es lo único que se
 * guarda del origen: ni la URL completa, ni nada del navegador de quien
 * compró. Sirve para decidir dónde publicar, no para seguir a nadie.
 */
export type SourceRow = {
  source: string;
  orders: number;
  grossCents: number;
};

export async function getSourceBreakdown(venueId: string): Promise<SourceRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("source, total_cents")
    .eq("venue_id", venueId)
    .eq("status", "paid")
    .limit(1000);

  const acumulado = new Map<string, SourceRow>();
  for (const row of data ?? []) {
    // Sin etiqueta = entrada directa: contarla aparte evita creer que todo
    // viene de las campañas.
    const source = (row.source as string | null) ?? "directo";
    const actual = acumulado.get(source) ?? { source, orders: 0, grossCents: 0 };
    actual.orders += 1;
    actual.grossCents += Number(row.total_cents ?? 0);
    acumulado.set(source, actual);
  }

  return [...acumulado.values()].sort((a, b) => b.grossCents - a.grossCents);
}
