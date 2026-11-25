import { MapPin } from "lucide-react";
import Link from "next/link";

import { FavoriteButton } from "@/components/catalog/favorite-button";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/ui/cover-image";
import { cn, formatEventDate, formatPENShort, relativeDay } from "@/lib/utils";
import type { EventSummary } from "@/types/catalog";

/**
 * Tarjeta de evento.
 *
 * Orden de lectura, de arriba abajo: portada, nombre, cuándo y dónde, local y
 * género, precio. Es el orden en que alguien decide si le interesa, y por eso
 * el precio va al final y separado: se mira después de querer ir, no antes.
 *
 * Dos cosas que se quitaron:
 *  · La fecha salía dos veces, en dos formatos distintos ("EN 6 DÍAS" arriba
 *    y "sábado 28 de noviembre" abajo). Ahora una sola, la que orienta.
 *  · La etiqueta «Disponible» no decía nada: casi todos los eventos lo están.
 *    Solo se marcan los estados que cambian la decisión —agotado, cerrado— y
 *    la etiqueta de demostración, que es una advertencia.
 */
export function EventCard({
  event,
  priority = false,
  className,
  favorite,
}: {
  event: EventSummary;
  priority?: boolean;
  className?: string;
  favorite?: { saved: boolean; isAuthenticated: boolean };
}) {
  const agotado = event.availability.tone === "soldout";
  const cerrado = event.availability.tone === "closed";
  const quedanPocas = event.availability.tone === "low";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-surface transition-colors duration-200 hover:border-white/25",
        className,
      )}
    >
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
        {/* 1 · Portada */}
        <div className="relative aspect-[3/2] w-full">
          <CoverImage
            src={event.coverUrl}
            alt=""
            name={event.name}
            priority={priority}
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
          />

          {/* Solo los estados que cambian la decision. */}
          {event.isDemo || agotado || cerrado ? (
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {agotado ? <Badge variant="danger">Agotado</Badge> : null}
              {cerrado && !agotado ? <Badge variant="outline">Venta cerrada</Badge> : null}
              {event.isDemo ? <Badge variant="demo">Demo</Badge> : null}
            </div>
          ) : null}

          {/* 2 · Nombre, sobre la franja oscurecida de la foto. */}
          <div className="absolute inset-x-4 bottom-3">
            <h3 className="t-card line-clamp-2 text-paper drop-shadow-sm">{event.name}</h3>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {/* 3 · Cuando y donde, en una sola linea y un solo formato. */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {/* `first-letter:uppercase`: relativeDay devuelve "hoy" en
                minuscula porque dentro de una frase va asi, pero aqui abre
                linea. */}
            <span className="font-semibold capitalize text-lime">
              {relativeDay(event.startsAt)}
            </span>
            <span className="text-muted" aria-hidden="true">
              ·
            </span>
            <span className="text-muted">{formatEventDate(event.startsAt, { withTime: false })}</span>
            <span className="text-muted" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-muted">
              <MapPin className="size-3.5" aria-hidden="true" />
              {event.venue.district}
            </span>
          </p>

          {/* 4 · Local y genero. */}
          <p className="t-meta truncate">
            {event.venue.name}
            {event.musicGenres.length > 0 ? (
              <>
                <span aria-hidden="true"> · </span>
                {event.musicGenres.slice(0, 2).join(", ")}
              </>
            ) : null}
          </p>

          {/* 5 · Precio, separado del resto. */}
          <div className="flex items-end justify-between gap-3 border-t border-white/[0.07] pt-3">
            <div>
              {event.priceFromCents !== null ? (
                <>
                  <span className="t-label block">Desde</span>
                  <span className="t-price">{formatPENShort(event.priceFromCents)}</span>
                </>
              ) : (
                <span className="t-meta">Sin venta online</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-right">
              {quedanPocas ? (
                <span className="text-xs font-medium text-amber-200">
                  {event.availability.label}
                </span>
              ) : null}
              <span className="text-xs text-muted">{event.minAge}+</span>
            </div>
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
      className="group flex w-[260px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-surface transition-colors duration-200 hover:border-white/25"
    >
      <div className="relative aspect-[16/10]">
        <CoverImage src={event.coverUrl} alt="" name={event.name} sizes="260px" />
        {event.isDemo ? (
          <Badge variant="demo" className="absolute left-2 top-2">
            Demo
          </Badge>
        ) : null}
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-lime">{relativeDay(event.startsAt)}</p>
        <h3 className="mt-1 line-clamp-1 font-display text-sm font-semibold">{event.name}</h3>
        <p className="t-meta mt-0.5 line-clamp-1 text-xs">
          {event.venue.name} · {event.venue.district}
        </p>
      </div>
    </Link>
  );
}
