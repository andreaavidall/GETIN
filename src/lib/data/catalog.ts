import "server-only";

import { availabilityLabel, priceFromCents } from "@/lib/domain/availability";
import { applyEventFilters, isThisWeekend } from "@/lib/domain/event-filters";
import { dataMode } from "@/lib/env";
import {
  demoEventBySlug,
  demoEventSummaries,
  demoEvents,
  demoVenueBySlug,
  demoVenues,
} from "@/lib/data/demo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  EventDetail,
  EventFilters,
  EventSummary,
  GuestListView,
  TableView,
  TicketTypeView,
  VenueDetail,
  VenueSummary,
} from "@/types/catalog";

/**
 * Catalogo publico.
 *
 * Una sola interfaz con dos implementaciones:
 *  - `demo`: dataset ficticio en memoria (para arrancar sin Supabase).
 *  - `live`: consultas a Postgres por el cliente con RLS, de modo que un evento
 *    en borrador o de un local no aprobado no puede salir aquí ni por error.
 *
 * Las páginas no saben en cual de los dos estan; solo `isDemoMode()` para
 * pintar el aviso.
 */

export function isDemoMode(): boolean {
  return dataMode() === "demo";
}

// ------------------------------------------------------------- mapeadores ----

type TicketRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number;
  sold_count: number;
  held_count: number;
  max_per_order: number;
  sales_start_at: string | null;
  sales_end_at: string | null;
  conditions: string | null;
  is_active: boolean;
};

function toTicketType(row: TicketRow): TicketTypeView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: Number(row.price_cents),
    capacity: row.capacity,
    soldCount: row.sold_count,
    heldCount: row.held_count,
    maxPerOrder: row.max_per_order,
    salesStartAt: row.sales_start_at ? new Date(row.sales_start_at) : null,
    salesEndAt: row.sales_end_at ? new Date(row.sales_end_at) : null,
    isActive: row.is_active,
    conditions: row.conditions,
  };
}

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  district: string;
  address: string;
  city: string;
  description: string | null;
  cover_url: string | null;
  music_genres: string[] | null;
  is_verified: boolean;
  is_demo: boolean;
  lat: number | string | null;
  lng: number | string | null;
  phone: string | null;
  instagram: string | null;
  capacity: number | null;
  min_age: number;
  dress_code: string | null;
};

function toVenueDetail(row: VenueRow, upcoming = 0): VenueDetail {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    district: row.district,
    address: row.address,
    city: row.city,
    description: row.description,
    coverUrl: row.cover_url,
    musicGenres: row.music_genres ?? [],
    isVerified: row.is_verified,
    isDemo: row.is_demo,
    upcomingEvents: upcoming,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    phone: row.phone,
    instagram: row.instagram,
    capacity: row.capacity,
    minAge: row.min_age,
    dressCode: row.dress_code,
  };
}

type EventRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  cover_url: string | null;
  starts_at: string;
  ends_at: string | null;
  doors_open_at: string | null;
  last_entry_at: string | null;
  min_age: number;
  music_genres: string[] | null;
  entry_rules: string | null;
  cancellation_policy: string | null;
  lineup: unknown;
  is_demo: boolean;
  venues: VenueRow | null;
  ticket_types: TicketRow[] | null;
};

const EVENT_SELECT = `
  id, slug, name, tagline, description, cover_url, starts_at, ends_at,
  doors_open_at, last_entry_at, min_age, music_genres, entry_rules,
  cancellation_policy, lineup, is_demo,
  venues!inner (
    id, slug, name, district, address, city, description, cover_url,
    music_genres, is_verified, is_demo, lat, lng, phone, instagram,
    capacity, min_age, dress_code
  ),
  ticket_types (
    id, name, description, price_cents, capacity, sold_count, held_count,
    max_per_order, sales_start_at, sales_end_at, conditions, is_active
  )
`;

function toEventSummary(row: EventRow, now: Date): EventSummary {
  const venue = row.venues;
  const tickets = (row.ticket_types ?? []).map(toTicketType);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    coverUrl: row.cover_url,
    startsAt: new Date(row.starts_at),
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    minAge: row.min_age,
    musicGenres: row.music_genres ?? [],
    isDemo: row.is_demo,
    venue: {
      id: venue?.id ?? "",
      slug: venue?.slug ?? "",
      name: venue?.name ?? "",
      district: venue?.district ?? "",
      isVerified: Boolean(venue?.is_verified),
    },
    priceFromCents: priceFromCents(tickets, now),
    availability: availabilityLabel(tickets, now),
    hasTables: false,
    hasGuestList: false,
  };
}

// ------------------------------------------------------------------ queries ---

export async function listEvents(
  filters: EventFilters = {},
  now: Date = new Date(),
): Promise<EventSummary[]> {
  if (isDemoMode()) {
    return applyEventFilters(demoEventSummaries(now), filters, now);
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "published")
    .order("starts_at", { ascending: filters.sort !== "date_desc" });

  // Por defecto solo eventos futuros.
  query = query.gte("starts_at", filters.dateFrom ?? now.toISOString());
  if (filters.dateTo) query = query.lte("starts_at", `${filters.dateTo}T23:59:59`);
  if (filters.district) query = query.eq("venues.district", filters.district);
  if (filters.venueSlug) query = query.eq("venues.slug", filters.venueSlug);
  if (filters.genre) query = query.contains("music_genres", [filters.genre]);
  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  query = query.limit(filters.limit ?? 60);

  const { data, error } = await query;
  if (error) throw new Error(`No se pudo cargar los eventos: ${error.message}`);

  const summaries = (data as unknown as EventRow[]).map((row) => toEventSummary(row, now));
  // El filtro de precio depende de los tipos de entrada: se aplica en memoria.
  return applyEventFilters(summaries, { ...filters, q: undefined }, now);
}

export async function getFeaturedEvents(limit = 6, now: Date = new Date()): Promise<EventSummary[]> {
  const events = await listEvents({ limit: 24 }, now);
  // Destacados = los mas próximos que todavia tienen entradas.
  return events.filter((e) => e.availability.tone !== "soldout").slice(0, limit);
}

export async function getWeekendEvents(limit = 6, now: Date = new Date()): Promise<EventSummary[]> {
  const events = await listEvents({ limit: 40 }, now);
  return events.filter((e) => isThisWeekend(e, now)).slice(0, limit);
}

export async function getUpcomingEvents(limit = 8, now: Date = new Date()): Promise<EventSummary[]> {
  const events = await listEvents({ limit: 40 }, now);
  return events.slice(0, limit);
}

export async function getEventBySlug(
  slug: string,
  now: Date = new Date(),
): Promise<EventDetail | null> {
  if (isDemoMode()) return demoEventBySlug(slug, now);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el evento: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as EventRow;
  const summary = toEventSummary(row, now);
  const venue = row.venues ? toVenueDetail(row.venues) : null;
  if (!venue) return null;

  const [tablesRes, listsRes] = await Promise.all([
    supabase
      .from("event_table_availability")
      .select(
        `id, state, price_cents, min_consumption_cents, deposit_cents, conditions, held_until,
         venue_tables!inner (id, label, zone, capacity, position_x, position_y)`,
      )
      .eq("event_id", row.id),
    supabase
      .from("guest_lists")
      .select(
        `id, name, description, capacity, confirmed_count, signup_deadline, last_entry_at,
         conditions, benefits, auto_approve, is_active`,
      )
      .eq("event_id", row.id)
      .eq("is_active", true),
  ]);

  type TableRow = {
    id: string;
    state: TableView["state"];
    price_cents: number;
    min_consumption_cents: number;
    deposit_cents: number;
    conditions: string | null;
    held_until: string | null;
    venue_tables: {
      id: string;
      label: string;
      zone: string | null;
      capacity: number;
      position_x: number | string | null;
      position_y: number | string | null;
    } | null;
  };

  const tables: TableView[] = ((tablesRes.data ?? []) as unknown as TableRow[]).map((t) => ({
    id: t.id,
    state: t.state,
    heldUntil: t.held_until ? new Date(t.held_until) : null,
    priceCents: Number(t.price_cents),
    depositCents: Number(t.deposit_cents),
    minConsumptionCents: Number(t.min_consumption_cents),
    conditions: t.conditions,
    venueTableId: t.venue_tables?.id ?? "",
    label: t.venue_tables?.label ?? "Mesa",
    zone: t.venue_tables?.zone ?? null,
    capacity: t.venue_tables?.capacity ?? 0,
    positionX: t.venue_tables?.position_x === null || t.venue_tables?.position_x === undefined
      ? null
      : Number(t.venue_tables.position_x),
    positionY: t.venue_tables?.position_y === null || t.venue_tables?.position_y === undefined
      ? null
      : Number(t.venue_tables.position_y),
  }));

  type ListRow = {
    id: string;
    name: string;
    description: string | null;
    capacity: number;
    confirmed_count: number;
    signup_deadline: string | null;
    last_entry_at: string | null;
    conditions: string | null;
    benefits: string | null;
    auto_approve: boolean;
  };

  const guestLists: GuestListView[] = ((listsRes.data ?? []) as unknown as ListRow[]).map((g) => {
    const deadline = g.signup_deadline ? new Date(g.signup_deadline) : null;
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      capacity: g.capacity,
      confirmedCount: g.confirmed_count,
      signupDeadline: deadline,
      lastEntryAt: g.last_entry_at ? new Date(g.last_entry_at) : null,
      conditions: g.conditions,
      benefits: g.benefits,
      autoApprove: g.auto_approve,
      isOpen: (!deadline || deadline > now) && g.confirmed_count < g.capacity,
    };
  });

  return {
    ...summary,
    description: row.description,
    doorsOpenAt: row.doors_open_at ? new Date(row.doors_open_at) : null,
    lastEntryAt: row.last_entry_at ? new Date(row.last_entry_at) : null,
    entryRules: row.entry_rules,
    cancellationPolicy: row.cancellation_policy,
    lineup: Array.isArray(row.lineup) ? (row.lineup as EventDetail["lineup"]) : [],
    venue,
    ticketTypes: (row.ticket_types ?? []).map(toTicketType),
    tables,
    guestLists,
    hasTables: tables.some((t) => t.state === "available"),
    hasGuestList: guestLists.some((g) => g.isOpen),
  };
}

// -------------------------------------------------------------------- locales ---

export async function listVenues(
  opts: { district?: string; q?: string; limit?: number } = {},
  now: Date = new Date(),
): Promise<VenueSummary[]> {
  if (isDemoMode()) {
    let venues = demoVenues(now);
    if (opts.district) venues = venues.filter((v) => v.district === opts.district);
    if (opts.q) {
      const needle = opts.q.toLowerCase();
      venues = venues.filter(
        (v) =>
          v.name.toLowerCase().includes(needle) || v.district.toLowerCase().includes(needle),
      );
    }
    return opts.limit ? venues.slice(0, opts.limit) : venues;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("venues")
    .select(
      `id, slug, name, district, address, city, description, cover_url, music_genres,
       is_verified, is_demo, lat, lng, phone, instagram, capacity, min_age, dress_code,
       events (id, status, starts_at)`,
    )
    .eq("status", "approved")
    .order("name");

  if (opts.district) query = query.eq("district", opts.district);
  if (opts.q) query = query.ilike("name", `%${opts.q}%`);
  query = query.limit(opts.limit ?? 50);

  const { data, error } = await query;
  if (error) throw new Error(`No se pudo cargar las discotecas: ${error.message}`);

  type Row = VenueRow & { events: { status: string; starts_at: string }[] | null };
  return (data as unknown as Row[]).map((row) => {
    const upcoming = (row.events ?? []).filter(
      (e) => e.status === "published" && new Date(e.starts_at) > now,
    ).length;
    return toVenueDetail(row, upcoming);
  });
}

export async function getVenueBySlug(
  slug: string,
  now: Date = new Date(),
): Promise<{ venue: VenueDetail; events: EventSummary[] } | null> {
  if (isDemoMode()) {
    const venue = demoVenueBySlug(slug, now);
    if (!venue) return null;
    const events = demoEvents(now).filter((e) => e.venue.slug === slug && e.startsAt > now);
    return { venue, events };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("venues")
    .select(
      `id, slug, name, district, address, city, description, cover_url, music_genres,
       is_verified, is_demo, lat, lng, phone, instagram, capacity, min_age, dress_code`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar la discoteca: ${error.message}`);
  if (!data) return null;

  const events = await listEvents({ venueSlug: slug, limit: 20 }, now);
  return { venue: toVenueDetail(data as unknown as VenueRow, events.length), events };
}

/** Eventos con mesas VIP libres, para la seccion de la portada. */
export async function getEventsWithTables(limit = 4, now: Date = new Date()): Promise<
  { event: EventSummary; tables: TableView[] }[]
> {
  if (isDemoMode()) {
    return demoEvents(now)
      .filter((e) => e.tables.some((t) => t.state === "available"))
      .slice(0, limit)
      .map((e) => ({ event: e, tables: e.tables.filter((t) => t.state === "available") }));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_table_availability")
    .select(
      `id, state, price_cents, min_consumption_cents, deposit_cents, conditions, held_until,
       venue_tables!inner (id, label, zone, capacity, position_x, position_y),
       events!inner (${EVENT_SELECT})`,
    )
    .eq("state", "available")
    .gte("events.starts_at", now.toISOString())
    .limit(limit * 4);

  if (error) return [];

  type Row = {
    id: string;
    state: TableView["state"];
    price_cents: number;
    min_consumption_cents: number;
    deposit_cents: number;
    conditions: string | null;
    held_until: string | null;
    venue_tables: {
      id: string;
      label: string;
      zone: string | null;
      capacity: number;
      position_x: number | string | null;
      position_y: number | string | null;
    } | null;
    events: EventRow | null;
  };

  const grouped = new Map<string, { event: EventSummary; tables: TableView[] }>();
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.events) continue;
    const summary = toEventSummary(row.events, now);
    const entry = grouped.get(summary.id) ?? { event: summary, tables: [] };
    entry.tables.push({
      id: row.id,
      state: row.state,
      heldUntil: row.held_until ? new Date(row.held_until) : null,
      priceCents: Number(row.price_cents),
      depositCents: Number(row.deposit_cents),
      minConsumptionCents: Number(row.min_consumption_cents),
      conditions: row.conditions,
      venueTableId: row.venue_tables?.id ?? "",
      label: row.venue_tables?.label ?? "Mesa",
      zone: row.venue_tables?.zone ?? null,
      capacity: row.venue_tables?.capacity ?? 0,
      positionX: row.venue_tables?.position_x == null ? null : Number(row.venue_tables.position_x),
      positionY: row.venue_tables?.position_y == null ? null : Number(row.venue_tables.position_y),
    });
    grouped.set(summary.id, entry);
  }
  return [...grouped.values()].slice(0, limit);
}
