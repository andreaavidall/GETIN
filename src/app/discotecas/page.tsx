import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { MapToggle } from "@/components/catalog/map-toggle";
import type { MapPoint } from "@/components/catalog/venue-map";
import { VenueCard } from "@/components/catalog/venue-card";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState, EventGridSkeleton } from "@/components/ui/feedback";
import { getSession } from "@/lib/auth/session";
import { isDemoMode, listVenues } from "@/lib/data/catalog";
import { getFavoriteIds } from "@/lib/data/favorites";
import { LIMA_DISTRICTS } from "@/types/catalog";

export const metadata: Metadata = {
  title: "Discotecas en Lima",
  description:
    "Directorio de discotecas y clubes nocturnos verificados en Lima: Barranco, Miraflores, San Isidro y mas.",
};

export const revalidate = 300;

type SearchParams = Promise<{ distrito?: string }>;

export default async function VenuesPage({ searchParams }: { searchParams: SearchParams }) {
  const { distrito } = await searchParams;

  return (
    <div className="container space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-display text-3xl sm:text-4xl">Discotecas</h1>
        <p className="text-sm text-muted">
          Solo aparecen los locales aprobados por GETIN. La insignia de verificado indica que
          comprobamos su información comercial.
        </p>
      </header>

      {isDemoMode() ? <DemoNotice /> : null}

      <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Link
          href="/discotecas"
          className={`shrink-0 rounded-xl px-4 py-2 text-sm ${
            !distrito ? "bg-lime font-semibold text-ink" : "bg-white/5 text-muted hover:text-paper"
          }`}
        >
          Todo Lima
        </Link>
        {LIMA_DISTRICTS.map((d) => (
          <Link
            key={d}
            href={`/discotecas?distrito=${encodeURIComponent(d)}`}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm ${
              distrito === d ? "bg-lime font-semibold text-ink" : "bg-white/5 text-muted hover:text-paper"
            }`}
          >
            {d}
          </Link>
        ))}
      </nav>

      <Suspense key={distrito ?? "all"} fallback={<EventGridSkeleton count={6} />}>
        <VenueResults district={distrito} />
      </Suspense>
    </div>
  );
}

async function VenueResults({ district }: { district?: string }) {
  const [venues, session, favoritos] = await Promise.all([
    listVenues({ district }),
    getSession(),
    getFavoriteIds(),
  ]);
  const demo = isDemoMode();

  if (venues.length === 0) {
    return (
      <EmptyState
        title={district ? `Sin discotecas en ${district}` : "Aún no hay discotecas publicadas"}
        description="Si gestionas un local, puedes registrarlo y publicarlo tras la verificación."
        action={
          <Button asChild variant="outline">
            <Link href="/club/registro">Publicar mi local</Link>
          </Button>
        }
      />
    );
  }

  // Solo entran en el mapa los locales con coordenadas; el resto se cuenta y
  // se dice, en vez de desaparecer sin explicacion.
  const points: MapPoint[] = venues
    .filter((v): v is typeof v & { lat: number; lng: number } => v.lat !== null && v.lng !== null)
    .map((v) => ({
      id: v.id,
      slug: v.slug,
      name: v.name,
      district: v.district,
      lat: v.lat,
      lng: v.lng,
      href: `/discotecas/${v.slug}`,
    }));

  return (
    <MapToggle points={points} sinUbicacion={venues.length - points.length}>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {venues.map((venue) => (
        <VenueCard
          key={venue.id}
          venue={venue}
          favorite={
            demo
              ? undefined
              : { saved: favoritos.venues.has(venue.id), isAuthenticated: Boolean(session) }
          }
        />
      ))}
    </div>
    </MapToggle>
  );
}
