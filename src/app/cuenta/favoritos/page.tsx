import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EventCard } from "@/components/catalog/event-card";
import { VenueCard } from "@/components/catalog/venue-card";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState } from "@/components/ui/feedback";
import { isDemoMode } from "@/lib/data/catalog";
import { listFavorites } from "@/lib/data/favorites";

export const metadata: Metadata = { title: "Mis favoritos", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Favoritos del usuario.
 *
 * Se leen de la base, no del navegador: quien guarda un plan en el celular
 * espera encontrarlo en la computadora.
 */
export default async function FavoritesPage() {
  if (isDemoMode()) {
    return (
      <div className="space-y-4">
        <DemoNotice />
        <EmptyState
          icon={Heart}
          title="Los favoritos necesitan base de datos"
          description="En modo demostración los eventos son ficticios y no se pueden guardar. Con Supabase configurado, el corazón aparece en cada evento y local."
          action={
            <Button asChild variant="outline">
              <Link href="/eventos">Ver eventos</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { events, venues } = await listFavorites();

  if (events.length === 0 && venues.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Todavía no has guardado nada"
        description="Toca el corazón en un evento o en una discoteca y lo encontrarás aquí, en cualquier dispositivo donde inicies sesión."
        action={
          <Button asChild>
            <Link href="/eventos">Explorar eventos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-10">
      {events.length > 0 ? (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-display text-xl">Eventos guardados</h2>
            <p className="text-xs text-muted">
              {events.length === 1 ? "1 evento" : `${events.length} eventos`}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                favorite={{ saved: true, isAuthenticated: true }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {venues.length > 0 ? (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-display text-xl">Discotecas guardadas</h2>
            <p className="text-xs text-muted">
              {venues.length === 1 ? "1 local" : `${venues.length} locales`}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                favorite={{ saved: true, isAuthenticated: true }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
