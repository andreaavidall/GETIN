import "server-only";

import { availabilityLabel, priceFromCents } from "@/lib/domain/availability";
import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/data/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EventSummary, VenueSummary } from "@/types/catalog";

/**
 * Lectura de favoritos.
 *
 * En modo demostración no hay nada que leer: los eventos ficticios viven en
 * memoria y no tienen fila en la base, así que no pueden guardarse. Las
 * páginas lo resuelven no mostrando el botón.
 */
export type FavoriteIds = { events: Set<string>; venues: Set<string> };

const EMPTY: FavoriteIds = { events: new Set(), venues: new Set() };

export async function getFavoriteIds(): Promise<FavoriteIds> {
  if (isDemoMode()) return EMPTY;
  const session = await getSession();
  if (!session) return EMPTY;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("favorites").select("event_id, venue_id");
  if (error || !data) return EMPTY;

  const ids: FavoriteIds = { events: new Set(), venues: new Set() };
  for (const row of data) {
    if (row.event_id) ids.events.add(row.event_id as string);
    if (row.venue_id) ids.venues.add(row.venue_id as string);
  }
  return ids;
}

/** Lista completa para la página de la cuenta. */
export async function listFavorites(
  now: Date = new Date(),
): Promise<{ events: EventSummary[]; venues: VenueSummary[] }> {
  if (isDemoMode()) return { events: [], venues: [] };
  const session = await getSession();
  if (!session) return { events: [], venues: [] };

  const supabase = await createSupabaseServerClient();

  // Dos consultas en vez de un join doble: cada una trae solo lo que la
  // tarjeta necesita y el plan queda legible.
  const [eventRes, venueRes] = await Promise.all([
    supabase
      .from("favorites")
      .select(
        `created_at,
         events!inner (
           id, slug, name, tagline, cover_url, starts_at, ends_at, min_age,
           music_genres, is_demo, status,
           venues!inner (id, slug, name, district, is_verified, is_demo, lat, lng),
           ticket_types (
             id, name, description, price_cents, capacity, sold_count,
             held_count, max_per_order, sales_start_at, sales_end_at,
             conditions, is_active
           )
         )`,
      )
      .not("event_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("favorites")
      .select(
        `created_at,
         venues!inner (
           id, slug, name, district, cover_url, music_genres, is_verified,
           is_demo, lat, lng, events (id, status, starts_at)
         )`,
      )
      .not("venue_id", "is", null)
      .order("created_at", { ascending: false }),
  ]);

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

  type FavEventRow = {
    events: {
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      cover_url: string | null;
      starts_at: string;
      ends_at: string | null;
      min_age: number;
      music_genres: string[] | null;
      is_demo: boolean;
      status: string;
      venues: {
        id: string;
        slug: string;
        name: string;
        district: string;
        is_verified: boolean;
        is_demo: boolean;
        lat: number | string | null;
        lng: number | string | null;
      } | null;
      ticket_types: TicketRow[] | null;
    } | null;
  };

  type FavVenueRow = {
    venues: {
      id: string;
      slug: string;
      name: string;
      district: string;
      cover_url: string | null;
      music_genres: string[] | null;
      is_verified: boolean;
      is_demo: boolean;
      lat: number | string | null;
      lng: number | string | null;
      events: { id: string; status: string; starts_at: string }[] | null;
    } | null;
  };

  const events: EventSummary[] = ((eventRes.data as unknown as FavEventRow[]) ?? [])
    .map((row) => row.events)
    .filter((e): e is NonNullable<FavEventRow["events"]> => e !== null && e.status === "published")
    .map((e) => {
      const tickets = (e.ticket_types ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        priceCents: Number(t.price_cents),
        capacity: t.capacity,
        soldCount: t.sold_count,
        heldCount: t.held_count,
        maxPerOrder: t.max_per_order,
        salesStartAt: t.sales_start_at ? new Date(t.sales_start_at) : null,
        salesEndAt: t.sales_end_at ? new Date(t.sales_end_at) : null,
        isActive: t.is_active,
        conditions: t.conditions,
      }));
      return {
        id: e.id,
        slug: e.slug,
        name: e.name,
        tagline: e.tagline,
        coverUrl: e.cover_url,
        startsAt: new Date(e.starts_at),
        endsAt: e.ends_at ? new Date(e.ends_at) : null,
        minAge: e.min_age,
        musicGenres: e.music_genres ?? [],
        isDemo: e.is_demo,
        venue: {
          id: e.venues?.id ?? "",
          slug: e.venues?.slug ?? "",
          name: e.venues?.name ?? "",
          district: e.venues?.district ?? "",
          isVerified: Boolean(e.venues?.is_verified),
          lat: e.venues?.lat == null ? null : Number(e.venues.lat),
          lng: e.venues?.lng == null ? null : Number(e.venues.lng),
        },
        priceFromCents: priceFromCents(tickets, now),
        availability: availabilityLabel(tickets, now),
        hasTables: false,
        hasGuestList: false,
      } satisfies EventSummary;
    });

  const venues: VenueSummary[] = ((venueRes.data as unknown as FavVenueRow[]) ?? [])
    .map((row) => row.venues)
    .filter((v): v is NonNullable<FavVenueRow["venues"]> => v !== null)
    .map((v) => ({
      id: v.id,
      slug: v.slug,
      name: v.name,
      district: v.district,
      coverUrl: v.cover_url,
      musicGenres: v.music_genres ?? [],
      isVerified: v.is_verified,
      isDemo: v.is_demo,
      upcomingEvents: (v.events ?? []).filter(
        (e) => e.status === "published" && new Date(e.starts_at) >= now,
      ).length,
      lat: v.lat == null ? null : Number(v.lat),
      lng: v.lng == null ? null : Number(v.lng),
    }));

  // Primero lo que todavía se puede usar: eventos futuros antes que pasados.
  events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return { events, venues };
}
