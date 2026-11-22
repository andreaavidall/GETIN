import { BadgeCheck, Instagram, MapPin, Phone, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { EventCard } from "@/components/catalog/event-card";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { PromotionList, VenueFacts, VenueGallery } from "@/components/catalog/venue-details";
import { Badge } from "@/components/ui/badge";
import { DemoNotice, EmptyState } from "@/components/ui/feedback";
import { getSession } from "@/lib/auth/session";
import { getVenueBySlug, isDemoMode } from "@/lib/data/catalog";
import { getFavoriteIds } from "@/lib/data/favorites";

type Params = Promise<{ slug: string }>;

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getVenueBySlug(slug);
  if (!result) return { title: "Discoteca no encontrada" };

  const { venue } = result;
  return {
    title: `${venue.name} · ${venue.district}`,
    description:
      venue.description ?? `${venue.name}, discoteca en ${venue.district}, Lima. Eventos y mesas VIP.`,
    openGraph: {
      title: venue.name,
      description: venue.description ?? undefined,
      images: venue.coverUrl ? [{ url: venue.coverUrl }] : undefined,
    },
  };
}

export default async function VenuePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [result, session, favoritos] = await Promise.all([
    getVenueBySlug(slug),
    getSession(),
    getFavoriteIds(),
  ]);
  if (!result) notFound();

  const { venue, events } = result;
  const demo = isDemoMode();

  return (
    <article>
      <header className="relative isolate -mt-16 overflow-hidden pt-16">
        {venue.coverUrl ? (
          <Image src={venue.coverUrl} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        <div className="absolute inset-0 hero-scrim" />

        <div className="container relative flex min-h-[340px] flex-col justify-end pb-8 pt-16">
          <div className="mb-3 flex flex-wrap gap-2">
            {venue.isDemo ? <Badge variant="demo">Local de demostración</Badge> : null}
            {venue.isVerified && !venue.isDemo ? (
              <Badge variant="lime">
                <BadgeCheck className="size-3" />
                Verificado por GETIN
              </Badge>
            ) : (
              <Badge variant="outline">Sin verificar</Badge>
            )}
            <Badge variant="outline">{venue.minAge}+</Badge>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-display text-4xl sm:text-5xl">{venue.name}</h1>
            {demo ? null : (
              <FavoriteButton
                target="venue"
                id={venue.id}
                initial={favoritos.venues.has(venue.id)}
                isAuthenticated={Boolean(session)}
                next={`/discotecas/${venue.slug}`}
                variant="full"
                label={favoritos.venues.has(venue.id) ? "Guardado" : "Guardar local"}
              />
            )}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/75">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-muted" />
              {venue.address}
            </span>
            {venue.capacity ? (
              <span className="flex items-center gap-1.5">
                <Users className="size-4 text-muted" />
                Aforo {venue.capacity}
              </span>
            ) : null}
            {venue.phone ? (
              <span className="flex items-center gap-1.5">
                <Phone className="size-4 text-muted" />
                {venue.phone}
              </span>
            ) : null}
            {venue.instagram ? (
              <span className="flex items-center gap-1.5">
                <Instagram className="size-4 text-muted" />
                {venue.instagram}
              </span>
            ) : null}
          </p>
        </div>
      </header>

      <div className="container space-y-10 py-10">
        {demo ? <DemoNotice /> : null}

        <PromotionList promotions={venue.promotions} />

        <VenueFacts venue={venue} />

        <VenueGallery venue={venue} />

        {venue.description ? (
          <section>
            <h2 className="text-display mb-3 text-xl">El local</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-white/80">{venue.description}</p>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="surface p-5">
            <h3 className="font-display text-base font-semibold">Ingreso</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Edad mínima</dt>
                <dd>{venue.minAge} años</dd>
              </div>
              {venue.dressCode ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Vestimenta</dt>
                  <dd className="text-right">{venue.dressCode}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Distrito</dt>
                <dd>{venue.district}</dd>
              </div>
            </dl>
          </div>

          <div className="surface p-5">
            <h3 className="font-display text-base font-semibold">Musica</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {venue.musicGenres.length > 0 ? (
                venue.musicGenres.map((genre) => (
                  <span key={genre} className="rounded-full bg-white/5 px-3 py-1 text-xs">
                    {genre}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted">Sin generos indicados.</p>
              )}
            </div>
            {venue.lat !== null && venue.lng !== null ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-block text-sm text-lime hover:underline"
              >
                Ver en el mapa →
              </a>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="text-display mb-4 text-xl">Próximos eventos</h2>
          {events.length === 0 ? (
            <EmptyState
              title="Sin eventos publicados"
              description="Este local todavía no tiene eventos a la venta en GETIN."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  favorite={
                    demo
                      ? undefined
                      : { saved: favoritos.events.has(event.id), isAuthenticated: Boolean(session) }
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
