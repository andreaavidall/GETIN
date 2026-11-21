import { BadgeCheck, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { VenueSummary } from "@/types/catalog";

export function VenueCard({ venue }: { venue: VenueSummary }) {
  return (
    <Link
      href={`/discotecas/${venue.slug}`}
      className="surface surface-hover group block overflow-hidden"
    >
      <div className="relative aspect-[16/9] bg-white/5">
        {venue.coverUrl ? (
          <Image
            src={venue.coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : null}
        <div className="absolute inset-0 photo-scrim" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {venue.isDemo ? <Badge variant="demo">Demo</Badge> : null}
          {venue.isVerified ? (
            <Badge variant="lime">
              <BadgeCheck className="size-3" />
              Verificado
            </Badge>
          ) : null}
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-display text-lg font-bold leading-tight">{venue.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3" />
            {venue.district}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {venue.musicGenres.slice(0, 3).map((g) => (
            <span key={g} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">
              {g}
            </span>
          ))}
        </div>
        <p className="shrink-0 text-xs text-muted">
          {venue.upcomingEvents === 0
            ? "Sin eventos"
            : venue.upcomingEvents === 1
              ? "1 evento"
              : `${venue.upcomingEvents} eventos`}
        </p>
      </div>
    </Link>
  );
}
