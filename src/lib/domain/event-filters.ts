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

/** Inicio del dia local a partir de "YYYY-MM-DD". */
function dayStart(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
}

function dayEnd(iso: string): Date | null {
  const start = dayStart(iso);
  if (!start) return null;
  return new Date(start.getTime() + 86_400_000 - 1);
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

/** Rango del proximo fin de semana (viernes 18:00 a lunes 06:00). */
export function weekendRange(now: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(now);
  const daysToFriday = (5 - from.getDay() + 7) % 7;
  from.setDate(from.getDate() + daysToFriday);
  from.setHours(18, 0, 0, 0);
  if (daysToFriday === 0 && now.getHours() >= 18) {
    // Ya es viernes por la noche: el fin de semana es este.
    from.setTime(now.getTime());
  }
  const to = new Date(from);
  to.setDate(to.getDate() + 3);
  to.setHours(6, 0, 0, 0);
  return { from, to };
}

export function isThisWeekend(event: EventSummary, now: Date = new Date()): boolean {
  const { from, to } = weekendRange(now);
  return event.startsAt >= from && event.startsAt <= to;
}
