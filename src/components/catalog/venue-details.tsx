import { Accessibility, Camera, DoorOpen, Car, Sparkles } from "lucide-react";
import Image from "next/image";

import { cn, formatEventDate } from "@/lib/utils";
import type { Promotion, VenueDetail } from "@/types/catalog";

/**
 * Lo concreto del local: qué ambientes hay, cómo se entra, si hay rampa, dónde
 * se estaciona. Para decidir una noche esto pesa más que un párrafo de
 * descripción.
 *
 * Cada dato aparece solo si el local lo rellenó. Nada de "consultar" ni de
 * valores por defecto: un local sin rampa y un local que no contestó no son
 * lo mismo, y no se pueden mostrar igual.
 */
export function VenueFacts({
  venue,
  bare = false,
  className,
}: {
  venue: VenueDetail;
  /** Sin caja gris: cuando ya va dentro de otra seccion. */
  bare?: boolean;
  className?: string;
}) {
  const filas: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[] =
    [];

  if (venue.accessibility) {
    filas.push({ icon: Accessibility, label: "Accesibilidad", value: venue.accessibility });
  }
  if (venue.parking) {
    filas.push({ icon: Car, label: "Estacionamiento", value: venue.parking });
  }
  if (venue.entranceNotes) {
    filas.push({ icon: DoorOpen, label: "Punto de ingreso", value: venue.entranceNotes });
  }

  if (venue.ambiences.length === 0 && filas.length === 0) return null;

  const Caja = bare ? "div" : "section";

  return (
    <Caja className={cn(bare ? "" : "surface p-5", className)}>
      {bare ? null : (
        <h2 className="font-display text-base font-semibold">El local por dentro</h2>
      )}

      {venue.ambiences.length > 0 ? (
        <div className={bare ? "" : "mt-3"}>
          <p className="t-label">Ambientes</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {venue.ambiences.map((a) => (
              <li key={a} className="rounded-full bg-white/5 px-3 py-1 text-xs">
                {a}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {filas.length > 0 ? (
        <dl className="mt-4 space-y-3 border-t border-white/5 pt-4 text-sm">
          {filas.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-lime" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
                <dd className="mt-0.5">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      ) : null}
    </Caja>
  );
}

/**
 * Fotos del ambiente y de las mesas.
 *
 * Si el local no subió ninguna, se dice. Poner imágenes de banco sería
 * enseñar un local que no existe, que es justo lo que la gente descubre al
 * llegar.
 */
export function VenueGallery({
  venue,
  bare = false,
  className,
}: {
  venue: VenueDetail;
  bare?: boolean;
  className?: string;
}) {
  if (venue.photos.length === 0) {
    return (
      <div className={cn("flex items-start gap-3", bare ? "" : "surface p-5", className)}>
        <Camera className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
        <div>
          <h3 className="font-display text-base font-semibold">Fotos del local</h3>
          <p className="t-meta mt-1">
            {venue.name} todavía no subió fotos del ambiente ni de las mesas. No ponemos
            imágenes de archivo: verías un local que no es este.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {bare ? null : <h2 className="t-section mb-3">Fotos del local</h2>}
      <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
        {venue.photos.map((photo) => (
          <li
            key={photo.id}
            className="relative aspect-[4/3] w-[260px] shrink-0 overflow-hidden rounded-xl bg-white/5 sm:w-auto"
          >
            <Image
              src={photo.url}
              alt={photo.alt ?? `${venue.name}: ${photo.kind}`}
              fill
              sizes="(max-width: 640px) 260px, 33vw"
              className="object-cover"
            />
            <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wide">
              {photo.kind}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Promociones publicadas por el local, con sus condiciones siempre visibles.
 * GETIN no inventa beneficios: si no hay acuerdo, esta sección no aparece.
 */
export function PromotionList({ promotions }: { promotions: Promotion[] }) {
  if (promotions.length === 0) return null;

  return (
    <section>
      <h2 className="t-section mb-3 flex items-center gap-2">
        <Sparkles className="size-5 text-lime" />
        Beneficios
      </h2>
      <ul className="space-y-3">
        {promotions.map((promo) => (
          <li key={promo.id} className="surface p-5">
            <h3 className="font-display text-base font-semibold text-lime">{promo.title}</h3>
            <p className="mt-1 text-sm">{promo.description}</p>
            <p className="mt-3 border-t border-white/10 pt-3 text-xs text-muted">
              <strong className="font-semibold text-paper">Condiciones:</strong>{" "}
              {promo.conditions}
            </p>
            {promo.endsAt ? (
              <p className="mt-1 text-xs text-muted">
                Válido hasta el {formatEventDate(promo.endsAt, { withTime: false })}.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Los beneficios los publica y los aplica el local. GETIN los muestra con sus condiciones
        tal como los recibió.
      </p>
    </section>
  );
}
