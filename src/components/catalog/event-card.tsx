import { BadgeCheck, CalendarDays, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { FavoriteButton } from "@/components/catalog/favorite-button";
import { AvailabilityBadge, Badge } from "@/components/ui/badge";
import { cn, formatEventDate, formatPENShort, relativeDay } from "@/lib/utils";
import type { EventSummary } from "@/types/catalog";

export function EventCard({
  event,
  priority = false,
  className,
  favorite,
}: {
  event: EventSummary;
  priority?: boolean;
  className?: string;
  /** Si llega, se pinta el corazon. Las paginas de demostracion no lo pasan. */
  favorite?: { saved: boolean; isAuthenticated: boolean };
}) {
  return (
    <article className={cn("surface surface-hover group relative overflow-hidden", className)}>
      {favorite ? (
        // Fuera del Link a proposito: un boton dentro de un enlace no es HTML
        // valido y rompe la navegacion con teclado.
        <div className="absolute right-3 top-3 z-10">
          <FavoriteButton
            target="event"
            id={event.id}
            initial={favorite.saved}
            isAuthenticated={favorite.isAuthenticated}
            next={`/eventos/${event.slug}`}
          />
        </div>
      ) : null}
      <Link href={`/eventos/${event.slug}`} className="block focus-visible:ring-inset">
        <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
          {event.coverUrl ? (
            <Image
              src={event.coverUrl}
              alt=""
              fill
              priority={priority}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          )}
          <div className="absolute inset-0 photo-scrim" />

          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {event.isDemo ? <Badge variant="demo">Demo</Badge> : null}
            <AvailabilityBadge tone={event.availability.tone} label={event.availability.label} />
          </div>

          <div className="absolute bottom-3 left-3 right-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-lime">
              <CalendarDays className="size-3" />
              {relativeDay(event.startsAt)}
            </p>
            <h3 className="mt-1 line-clamp-2 font-display text-lg font-bold leading-tight">
              {event.name}
            </h3>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-medium">
                {event.venue.name}
                {event.venue.isVerified && !event.isDemo ? (
                  <BadgeCheck
                    className="size-3.5 shrink-0 text-lime"
                    aria-label="Local verificado"
                  />
                ) : null}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <MapPin className="size-3" />
                {event.venue.district}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {event.priceFromCents !== null ? (
                <>
                  <p className="text-[10px] uppercase tracking-wide text-muted">Desde</p>
                  <p className="font-display text-base font-bold text-lime">
                    {formatPENShort(event.priceFromCents)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">Sin venta online</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-3 text-[11px] text-muted">
            <span>{formatEventDate(event.startsAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{event.minAge}+</span>
            {event.musicGenres.slice(0, 2).map((g) => (
              <span key={g} className="rounded-full bg-white/5 px-2 py-0.5">
                {g}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}

/** Variante compacta para carruseles horizontales en movil. */
export function EventCardCompact({ event }: { event: EventSummary }) {
  return (
    <Link
      href={`/eventos/${event.slug}`}
      className="surface surface-hover flex w-[260px] shrink-0 flex-col overflow-hidden"
    >
      <div className="relative aspect-[16/10] bg-white/5">
        {event.coverUrl ? (
          <Image
            src={event.coverUrl}
            alt=""
            fill
            sizes="260px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 photo-scrim" />
        {event.isDemo ? (
          <Badge variant="demo" className="absolute left-2 top-2">
            Demo
          </Badge>
        ) : null}
      </div>
      <div className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-lime">
          {relativeDay(event.startsAt)}
        </p>
        <h3 className="mt-1 line-clamp-1 font-display text-sm font-semibold">{event.name}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">
          {event.venue.name} · {event.venue.district}
        </p>
      </div>
    </Link>
  );
}
