import { limaDayOfWeek, limaStartOfDay } from "@/lib/utils";
import type { EventFilters, EventSummary } from "@/types/catalog";

/**
 * Filtrado y ordenamiento del explorador de eventos.
 *
 * Es una funcion pura para poder probarla y para que el modo demo y el modo con
 * base de datos se comporten igual (en `live` la mayor parte se resuelve en
 * Postgres, y esto se aplica al resultado por coherencia).
 */

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Inicio del día en LIMA a partir de "YYYY-MM-DD".
 *
 * Importa: con la hora del servidor (UTC en Vercel), un evento del sábado a
 * las 23:00 de Lima cae el domingo en UTC, y el filtro "hasta el sábado" lo
 * dejaba fuera aunque para cualquiera en Lima sea sábado. Perú es siempre
 * UTC-5, así que el desfase se fija explicitamente.
 */
function dayStart(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T00:00:00-05:00`);
}

function dayEnd(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T23:59:59.999-05:00`);
}

export function matchesFilters(
  event: EventSummary,
  filters: EventFilters,
  now: Date = new Date(),
): boolean {
  if (event.startsAt < now && !filters.dateFrom) return false;

  if (filters.q) {
    const needle = normalize(filters.q);
    const haystack = normalize(
      [event.name, event.tagline ?? "", event.venue.name, event.venue.district, event.musicGenres.join(" ")].join(" "),
    );
    if (!haystack.includes(needle)) return false;
  }

  if (filters.district && event.venue.district !== filters.district) return false;
  if (filters.venueSlug && event.venue.slug !== filters.venueSlug) return false;
  if (filters.genre && !event.musicGenres.includes(filters.genre)) return false;

  if (filters.dateFrom) {
    const from = dayStart(filters.dateFrom);
    if (from && event.startsAt < from) return false;
  }
  if (filters.dateTo) {
    const to = dayEnd(filters.dateTo);
    if (to && event.startsAt > to) return false;
  }

  if (typeof filters.maxPriceCents === "number") {
    // Un evento sin precio (venta cerrada) no pasa el filtro de precio.
    if (event.priceFromCents === null) return false;
    if (event.priceFromCents > filters.maxPriceCents) return false;
  }

  return true;
}

export function sortEvents<T extends EventSummary>(events: T[], sort: EventFilters["sort"]): T[] {
  const copy = [...events];
  switch (sort) {
    case "date_desc":
      return copy.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
    case "price_asc":
      return copy.sort(
        (a, b) => (a.priceFromCents ?? Infinity) - (b.priceFromCents ?? Infinity),
      );
    case "price_desc":
      return copy.sort(
        (a, b) => (b.priceFromCents ?? -Infinity) - (a.priceFromCents ?? -Infinity),
      );
    case "date_asc":
    default:
      return copy.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }
}

export function applyEventFilters<T extends EventSummary>(
  events: T[],
  filters: EventFilters,
  now: Date = new Date(),
): T[] {
  const filtered = events.filter((e) => matchesFilters(e, filters, now));
  const sorted = sortEvents(filtered, filters.sort);
  return typeof filters.limit === "number" ? sorted.slice(0, filters.limit) : sorted;
}

/**
 * Fin de semana vigente, en hora de Lima.
 *
 * Antes se calculaba con la hora del servidor y, además, el viernes se tomaba
 * como «el próximo viernes»: un domingo por la tarde la portada enseñaba los
 * eventos del fin de semana SIGUIENTE bajo el título «este fin de semana».
 *
 * Ahora: de viernes a domingo (y la madrugada del lunes hasta las 06:00) el
 * fin de semana es el que se está viviendo. De lunes a jueves es el que viene,
 * y `isUpcoming` lo dice para que la portada pueda titularlo bien.
 */
export function weekendRange(now: Date = new Date()): {
  from: Date;
  to: Date;
  isUpcoming: boolean;
} {
  const dow = limaDayOfWeek(now);
  const today = limaStartOfDay(now);
  const DAY = 86_400_000;

  // Viernes del fin de semana en curso o, de lunes a jueves, del próximo.
  let daysToFriday: number;
  if (dow === 5 || dow === 6) {
    daysToFriday = 5 - dow; // viernes (0) o sábado (-1)
  } else if (dow === 0) {
    daysToFriday = -2; // domingo: el viernes fue anteayer
  } else {
    daysToFriday = 5 - dow; // lunes a jueves: el viernes que viene
  }

  const from = new Date(today.getTime() + daysToFriday * DAY + 18 * 3_600_000);
  const to = new Date(from.getTime() + 3 * DAY - 12 * 3_600_000); // lunes 06:00

  // La madrugada del lunes sigue siendo el fin de semana anterior.
  if (dow === 1 && now.getTime() <= today.getTime() + 6 * 3_600_000) {
    const prevFrom = new Date(from.getTime() - 7 * DAY);
    return { from: prevFrom, to: new Date(prevFrom.getTime() + 3 * DAY - 12 * 3_600_000), isUpcoming: false };
  }

  return { from, to, isUpcoming: dow >= 1 && dow <= 4 };
}

export function isThisWeekend(event: EventSummary, now: Date = new Date()): boolean {
  const { from, to } = weekendRange(now);
  return event.startsAt >= from && event.startsAt <= to;
}
