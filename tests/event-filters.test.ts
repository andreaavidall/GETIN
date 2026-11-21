import { describe, expect, it } from "vitest";

import {
  applyEventFilters,
  isThisWeekend,
  matchesFilters,
  sortEvents,
  weekendRange,
} from "@/lib/domain/event-filters";
import type { EventSummary } from "@/types/catalog";

/** Filtrado del explorador: lo que decide si un evento se ve o no. */

const NOW = new Date("2026-03-11T12:00:00-05:00"); // miercoles

function event(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: "e1",
    slug: "saturday-house",
    name: "Saturday House",
    tagline: "La fiesta de casa",
    coverUrl: null,
    startsAt: new Date("2026-03-14T23:00:00-05:00"), // sabado
    endsAt: null,
    minAge: 20,
    musicGenres: ["House", "Reggaeton"],
    isDemo: false,
    venue: {
      id: "v1",
      slug: "nocturna-barranco",
      name: "Nocturna Barranco",
      district: "Barranco",
      isVerified: true,
    },
    priceFromCents: 7_000,
    availability: { tone: "available", label: "Disponible" },
    hasTables: true,
    hasGuestList: true,
    ...overrides,
  };
}

describe("matchesFilters", () => {
  it("sin filtros deja pasar un evento futuro", () => {
    expect(matchesFilters(event(), {}, NOW)).toBe(true);
  });

  it("descarta eventos pasados salvo que se pida un rango", () => {
    const past = event({ startsAt: new Date("2026-03-01T23:00:00-05:00") });
    expect(matchesFilters(past, {}, NOW)).toBe(false);
    expect(matchesFilters(past, { dateFrom: "2026-02-01" }, NOW)).toBe(true);
  });

  it("busca en nombre, local, distrito y generos, ignorando acentos y mayusculas", () => {
    const e = event({ name: "Noche Latina", venue: { ...event().venue, name: "Vértigo" } });
    expect(matchesFilters(e, { q: "latina" }, NOW)).toBe(true);
    expect(matchesFilters(e, { q: "VERTIGO" }, NOW)).toBe(true);
    expect(matchesFilters(e, { q: "vertigo" }, NOW)).toBe(true);
    expect(matchesFilters(e, { q: "barranco" }, NOW)).toBe(true);
    expect(matchesFilters(e, { q: "techno" }, NOW)).toBe(false);
  });

  it("filtra por distrito, local y genero de forma exacta", () => {
    expect(matchesFilters(event(), { district: "Barranco" }, NOW)).toBe(true);
    expect(matchesFilters(event(), { district: "Miraflores" }, NOW)).toBe(false);
    expect(matchesFilters(event(), { venueSlug: "nocturna-barranco" }, NOW)).toBe(true);
    expect(matchesFilters(event(), { venueSlug: "club-fauna" }, NOW)).toBe(false);
    expect(matchesFilters(event(), { genre: "House" }, NOW)).toBe(true);
    expect(matchesFilters(event(), { genre: "Salsa" }, NOW)).toBe(false);
  });

  it("el rango de fechas incluye el dia completo de 'hasta'", () => {
    const e = event({ startsAt: new Date("2026-03-14T23:30:00-05:00") });
    expect(matchesFilters(e, { dateTo: "2026-03-14" }, NOW)).toBe(true);
    expect(matchesFilters(e, { dateTo: "2026-03-13" }, NOW)).toBe(false);
  });

  it("el precio maximo descarta lo que lo supera y lo que no tiene venta", () => {
    expect(matchesFilters(event({ priceFromCents: 7_000 }), { maxPriceCents: 7_000 }, NOW)).toBe(true);
    expect(matchesFilters(event({ priceFromCents: 7_001 }), { maxPriceCents: 7_000 }, NOW)).toBe(false);
    expect(matchesFilters(event({ priceFromCents: null }), { maxPriceCents: 10_000 }, NOW)).toBe(false);
  });

  it("ignora un filtro de texto vacio", () => {
    expect(matchesFilters(event(), { q: undefined }, NOW)).toBe(true);
  });
});

describe("sortEvents", () => {
  const cheapLate = event({ id: "a", priceFromCents: 3_000, startsAt: new Date("2026-03-20T23:00:00-05:00") });
  const pricyEarly = event({ id: "b", priceFromCents: 12_000, startsAt: new Date("2026-03-13T23:00:00-05:00") });
  const noPrice = event({ id: "c", priceFromCents: null, startsAt: new Date("2026-03-15T23:00:00-05:00") });

  it("ordena por fecha ascendente por defecto", () => {
    expect(sortEvents([cheapLate, pricyEarly, noPrice], undefined).map((e) => e.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("ordena por fecha descendente", () => {
    expect(sortEvents([pricyEarly, cheapLate], "date_desc").map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("ordena por precio y manda al final los que no tienen venta", () => {
    expect(sortEvents([pricyEarly, noPrice, cheapLate], "price_asc").map((e) => e.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("no modifica el array original", () => {
    const input = [cheapLate, pricyEarly];
    sortEvents(input, "price_asc");
    expect(input.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("applyEventFilters", () => {
  it("filtra, ordena y limita en una pasada", () => {
    const events = [
      event({ id: "a", name: "House Night", priceFromCents: 9_000 }),
      event({ id: "b", name: "Techno Night", musicGenres: ["Techno"], priceFromCents: 5_000 }),
      event({ id: "c", name: "Salsa Night", musicGenres: ["Salsa"], priceFromCents: 3_000 }),
    ];

    const result = applyEventFilters(events, { sort: "price_asc", limit: 2 }, NOW);
    expect(result.map((e) => e.id)).toEqual(["c", "b"]);
  });

  it("devuelve vacio cuando nada coincide", () => {
    expect(applyEventFilters([event()], { district: "Comas" }, NOW)).toEqual([]);
  });
});

describe("fin de semana", () => {
  it("el rango va del viernes por la tarde al lunes de madrugada", () => {
    const { from, to } = weekendRange(NOW);
    expect(from.getDay()).toBe(5); // viernes
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });

  it("un sabado por la noche cuenta como este fin de semana", () => {
    expect(isThisWeekend(event(), NOW)).toBe(true);
  });

  it("un miercoles de la semana siguiente no", () => {
    const next = event({ startsAt: new Date("2026-03-18T23:00:00-05:00") });
    expect(isThisWeekend(next, NOW)).toBe(false);
  });
});
