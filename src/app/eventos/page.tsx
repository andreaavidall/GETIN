import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EventCard } from "@/components/catalog/event-card";
import { MapToggle } from "@/components/catalog/map-toggle";
import type { MapPoint } from "@/components/catalog/venue-map";
import { EventFiltersPanel } from "@/components/catalog/event-filters-panel";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState, ErrorState, EventGridSkeleton } from "@/components/ui/feedback";
import { getSession } from "@/lib/auth/session";
import { isDemoMode, listEvents } from "@/lib/data/catalog";
import { getFavoriteIds } from "@/lib/data/favorites";
import type { EventFilters } from "@/types/catalog";

export const metadata: Metadata = {
  title: "Eventos en Lima",
  description:
    "Explora fiestas y eventos nocturnos en Lima. Filtra por distrito, fecha, precio, discoteca y género musical.",
};

export const revalidate = 60;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Traduce los parametros de la URL (en español) a los filtros del dominio. */
function parseFilters(params: Record<string, string | string[] | undefined>): EventFilters {
  const one = (key: string): string | undefined => {
    const value = params[key];
    const raw = Array.isArray(value) ? value[0] : value;
    return raw && raw.trim() !== "" ? raw.trim() : undefined;
  };

  const precioMax = one("precioMax");
  const sortMap: Record<string, EventFilters["sort"]> = {
    fecha: "date_asc",
    fecha_desc: "date_desc",
    precio: "price_asc",
    precio_desc: "price_desc",
  };

  return {
    q: one("q"),
    district: one("distrito"),
    genre: one("genero"),
    venueSlug: one("discoteca"),
    dateFrom: one("desde"),
    dateTo: one("hasta"),
    maxPriceCents: precioMax ? Math.round(Number(precioMax) * 100) : undefined,
    sort: sortMap[one("orden") ?? "fecha"] ?? "date_asc",
    limit: 60,
  };
}

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseFilters(params);

  return (
    <div className="container space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-display text-3xl sm:text-4xl">Eventos</h1>
        <p className="text-sm text-muted">
          Fiestas y eventos nocturnos en Lima. Los precios mostrados{" "}
          <strong className="text-paper">no incluyen el cargo por servicio</strong>: verás el
          desglose y el total antes de pagar.
        </p>
      </header>

      {isDemoMode() ? <DemoNotice /> : null}

      <Suspense fallback={<div className="skeleton h-14 w-full" />}>
        <EventFiltersPanel />
      </Suspense>

      <Suspense key={JSON.stringify(filters)} fallback={<EventGridSkeleton count={6} />}>
        <Results filters={filters} />
      </Suspense>
    </div>
  );
}

async function Results({ filters }: { filters: EventFilters }) {
  const [session, favoritos] = await Promise.all([getSession(), getFavoriteIds()]);
  const demo = isDemoMode();

  let events;
  try {
    events = await listEvents(filters);
  } catch (error) {
    return (
      <ErrorState
        detail={error instanceof Error ? error.message : "Error desconocido"}
        action={
          <Button asChild variant="outline">
            <Link href="/eventos">Reintentar</Link>
          </Button>
        }
      />
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="Ningún evento coincide con tu búsqueda"
        description="Prueba a quitar algún filtro, ampliar el rango de fechas o buscar en otro distrito."
        action={
          <Button asChild variant="outline">
            <Link href="/eventos">Quitar filtros</Link>
          </Button>
        }
      />
    );
  }

  const points: MapPoint[] = events
    .filter((e) => e.venue.lat !== null && e.venue.lng !== null)
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.venue.name,
      district: e.venue.district,
      lat: e.venue.lat as number,
      lng: e.venue.lng as number,
      eventName: e.name,
      startsAt: e.startsAt,
      priceFromCents: e.priceFromCents,
      href: `/eventos/${e.slug}`,
    }));

  return (
    <>
      <p className="text-xs text-muted" aria-live="polite">
        {events.length} {events.length === 1 ? "evento" : "eventos"}
      </p>
      <MapToggle points={points} sinUbicacion={events.length - points.length}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event, i) => (
          <EventCard
            key={event.id}
            event={event}
            priority={i < 3}
            favorite={
              demo
                ? undefined
                : { saved: favoritos.events.has(event.id), isAuthenticated: Boolean(session) }
            }
          />
        ))}
      </div>
      </MapToggle>
    </>
  );
}
