import { BadgeCheck, MapPin } from "lucide-react";
import Link from "next/link";

import { FavoriteButton } from "@/components/catalog/favorite-button";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/ui/cover-image";
import type { VenueSummary } from "@/types/catalog";

export function VenueCard({
  venue,
  favorite,
}: {
  venue: VenueSummary;
  favorite?: { saved: boolean; isAuthenticated: boolean };
}) {
  return (
    <div className="group relative overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-surface transition-colors duration-200 hover:border-white/25">
      {favorite ? (
        <div className="absolute right-3 top-3 z-10">
          <FavoriteButton
            target="venue"
            id={venue.id}
            initial={favorite.saved}
            isAuthenticated={favorite.isAuthenticated}
            next={`/discotecas/${venue.slug}`}
          />
        </div>
      ) : null}

      <Link href={`/discotecas/${venue.slug}`} className="block">
        <div className="relative aspect-[16/10]">
          <CoverImage
            src={venue.coverUrl}
            alt=""
            name={venue.name}
            sizes="(max-width: 640px) 90vw, 33vw"
          />

          {venue.isDemo || (venue.isVerified && !venue.isDemo) ? (
            <div className="absolute left-3 top-3 flex gap-1.5">
              {venue.isDemo ? <Badge variant="demo">Demo</Badge> : null}
              {venue.isVerified && !venue.isDemo ? (
                <Badge variant="lime">
                  <BadgeCheck className="size-3" />
                  Verificado
                </Badge>
              ) : null}
            </div>
          ) : null}

          <div className="absolute inset-x-4 bottom-3">
            <h3 className="t-card drop-shadow-sm">{venue.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-white/80">
              <MapPin className="size-3.5" aria-hidden="true" />
              {venue.district}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {venue.musicGenres.slice(0, 3).map((g) => (
              <span key={g} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-muted">
                {g}
              </span>
            ))}
          </div>
          <p className="shrink-0 text-sm text-muted">
            {venue.upcomingEvents === 0
              ? "Sin eventos"
              : venue.upcomingEvents === 1
                ? "1 evento"
                : `${venue.upcomingEvents} eventos`}
          </p>
        </div>
      </Link>
    </div>
  );
}
