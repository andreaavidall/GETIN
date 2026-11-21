import { describe, expect, it } from "vitest";

import { demoEvents, demoVenues } from "@/lib/data/demo";

/**
 * Coherencia del catalogo de demostracion.
 *
 * Nace de un fallo real: cada fecha de un evento se calculaba como un desfase
 * independiente desde "hoy" (`dentro de 4 dias`), mientras el evento se anclaba
 * al proximo sabado. Segun el dia en que se mirase la web, la preventa cerraba
 * DESPUES de la fiesta.
 *
 * Estas pruebas se ejecutan con la fecha real de hoy, asi que fallarian
 * cualquier dia de la semana en que la incoherencia reaparezca.
 */

const events = demoEvents();

describe("catalogo de demostracion", () => {
  it("tiene eventos", () => {
    expect(events.length).toBeGreaterThan(0);
  });

  it("todos los eventos son futuros", () => {
    const now = new Date();
    for (const event of events) {
      expect(event.startsAt.getTime(), `${event.name} ya paso`).toBeGreaterThan(now.getTime());
    }
  });

  it("el evento termina despues de empezar", () => {
    for (const event of events) {
      if (!event.endsAt) continue;
      expect(event.endsAt.getTime(), event.name).toBeGreaterThan(event.startsAt.getTime());
    }
  });

  it("las puertas abren antes o cuando empieza, y el ultimo ingreso es despues", () => {
    for (const event of events) {
      if (event.doorsOpenAt) {
        expect(event.doorsOpenAt.getTime(), `${event.name}: puertas`).toBeLessThanOrEqual(
          event.startsAt.getTime(),
        );
      }
      if (event.lastEntryAt) {
        expect(event.lastEntryAt.getTime(), `${event.name}: ultimo ingreso`).toBeGreaterThan(
          event.startsAt.getTime(),
        );
        if (event.endsAt) {
          expect(event.lastEntryAt.getTime(), `${event.name}: ingreso tras el cierre`)
            .toBeLessThanOrEqual(event.endsAt.getTime());
        }
      }
    }
  });

  it("ninguna venta de entradas cierra despues de que empiece el evento", () => {
    for (const event of events) {
      for (const type of event.ticketTypes) {
        if (!type.salesEndAt) continue;
        expect(
          type.salesEndAt.getTime(),
          `${event.name} · ${type.name}: la venta cierra despues del evento`,
        ).toBeLessThanOrEqual(event.startsAt.getTime());
      }
    }
  });

  it("la venta no empieza despues de cerrar", () => {
    for (const event of events) {
      for (const type of event.ticketTypes) {
        if (!type.salesStartAt || !type.salesEndAt) continue;
        expect(
          type.salesStartAt.getTime(),
          `${event.name} · ${type.name}`,
        ).toBeLessThan(type.salesEndAt.getTime());
      }
    }
  });

  it("las listas cierran su inscripcion antes de que empiece el evento", () => {
    for (const event of events) {
      for (const list of event.guestLists) {
        if (list.signupDeadline) {
          expect(
            list.signupDeadline.getTime(),
            `${event.name} · ${list.name}: inscripcion abierta tras el inicio`,
          ).toBeLessThanOrEqual(event.startsAt.getTime());
        }
        if (list.lastEntryAt) {
          expect(
            list.lastEntryAt.getTime(),
            `${event.name} · ${list.name}: ingreso antes de empezar`,
          ).toBeGreaterThan(event.startsAt.getTime());
        }
      }
    }
  });

  it("el inventario de cada entrada es coherente", () => {
    for (const event of events) {
      for (const type of event.ticketTypes) {
        expect(type.soldCount, `${event.name} · ${type.name}`).toBeLessThanOrEqual(type.capacity);
        expect(type.soldCount + type.heldCount, `${event.name} · ${type.name}`)
          .toBeLessThanOrEqual(type.capacity);
        expect(type.priceCents, `${event.name} · ${type.name}`).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(type.priceCents)).toBe(true);
      }
    }
  });

  it("el adelanto de una mesa nunca supera su precio", () => {
    for (const event of events) {
      for (const table of event.tables) {
        expect(table.depositCents, `${event.name} · ${table.label}`).toBeLessThanOrEqual(
          table.priceCents,
        );
      }
    }
  });

  it("todo el catalogo demo esta etiquetado como ficticio", () => {
    for (const event of events) {
      expect(event.isDemo, `${event.name} no esta marcado como demo`).toBe(true);
    }
    for (const venue of demoVenues()) {
      expect(venue.isDemo, `${venue.name} no esta marcado como demo`).toBe(true);
    }
  });

  it("cada evento apunta a un local existente del catalogo", () => {
    const slugs = new Set(demoVenues().map((v) => v.slug));
    for (const event of events) {
      expect(slugs.has(event.venue.slug), `${event.name} -> ${event.venue.slug}`).toBe(true);
    }
  });
});
