import { describe, expect, it } from "vitest";

import { weekendRange } from "@/lib/domain/event-filters";
import {
  formatCloseTime,
  formatEventDate,
  limaTimestamp,
  formatEventRange,
  limaDayNumber,
  limaISODate,
  limaMonthShort,
  relativeDay,
} from "@/lib/utils";

/**
 * Fechas en hora de Lima.
 *
 * Esto es lo que fallaba: la portada decía «28» y la ficha «27» para el mismo
 * evento, porque unas partes formateaban en la zona del servidor (UTC en
 * Vercel) y otras no. Perú es UTC-5 todo el año, así que un evento que empieza
 * a las 23:00 de Lima cae al día siguiente en UTC: es justo el caso que rompía.
 *
 * Las pruebas se escriben con la hora declarada en -05:00 para que digan lo
 * mismo en cualquier máquina.
 */
describe("formato de fechas en America/Lima", () => {
  // Sábado 28 de noviembre de 2026, 23:00 en Lima = domingo 29 a las 04:00 UTC.
  const sabadoNoche = new Date("2026-11-28T23:00:00-05:00");

  it("un evento de sábado por la noche sigue siendo sábado 28", () => {
    expect(limaDayNumber(sabadoNoche)).toBe(28);
    expect(limaMonthShort(sabadoNoche)).toBe("nov"); // la interfaz lo pone en mayusculas
    expect(formatEventDate(sabadoNoche)).toContain("sábado 28 de noviembre");
  });

  it("el día en UTC sería otro: por eso no se puede usar getDate()", () => {
    expect(sabadoNoche.getUTCDate()).toBe(29);
    expect(limaDayNumber(sabadoNoche)).toBe(28);
  });

  it("limaISODate devuelve el día de Lima, no el de UTC", () => {
    expect(limaISODate(sabadoNoche)).toBe("2026-11-28");
  });

  it("un evento que cierra de madrugada nombra el día de cierre", () => {
    const cierre = new Date("2026-11-29T06:00:00-05:00");
    const texto = formatEventRange(sabadoNoche, cierre);
    expect(texto).toContain("sábado 28 de noviembre");
    // El cierre es ya domingo: hay que decirlo, no dejar «23:00 – 06:00».
    expect(texto).toContain("domingo 29");
  });

  it("si empieza y termina el mismo día solo se añade la hora", () => {
    const inicio = new Date("2026-11-28T19:00:00-05:00");
    const fin = new Date("2026-11-28T23:30:00-05:00");
    expect(formatEventRange(inicio, fin)).not.toContain("domingo");
  });

  it("relativeDay cuenta días de Lima, no franjas de 24 horas", () => {
    const ahora = new Date("2026-11-22T22:00:00-05:00");
    const manana = new Date("2026-11-23T01:00:00-05:00"); // 3 horas después
    expect(relativeDay(manana, ahora)).toBe("mañana");
  });
});

describe("el fin de semana que se nombra es el que se enseña", () => {
  const casos: { dia: string; fecha: string; esperado: boolean }[] = [
    // Martes: lo que viene es el fin de semana SIGUIENTE.
    { dia: "martes", fecha: "2026-11-24T12:00:00-05:00", esperado: true },
    { dia: "jueves", fecha: "2026-11-26T12:00:00-05:00", esperado: true },
    // Viernes, sábado y domingo: el que se está viviendo.
    { dia: "viernes", fecha: "2026-11-27T22:00:00-05:00", esperado: false },
    { dia: "sábado", fecha: "2026-11-28T22:00:00-05:00", esperado: false },
    { dia: "domingo", fecha: "2026-11-29T14:00:00-05:00", esperado: false },
  ];

  for (const caso of casos) {
    it(`un ${caso.dia} isUpcoming es ${caso.esperado}`, () => {
      expect(weekendRange(new Date(caso.fecha)).isUpcoming).toBe(caso.esperado);
    });
  }

  it("el rango empieza un viernes de Lima y termina el lunes de madrugada", () => {
    const { from, to } = weekendRange(new Date("2026-11-24T12:00:00-05:00"));
    expect(limaISODate(from)).toBe("2026-11-27");
    expect(limaISODate(to)).toBe("2026-11-30");
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });

  it("la madrugada del lunes todavía pertenece al fin de semana anterior", () => {
    const lunesTemprano = new Date("2026-11-30T03:00:00-05:00");
    const { from, isUpcoming } = weekendRange(lunesTemprano);
    expect(isUpcoming).toBe(false);
    expect(limaISODate(from)).toBe("2026-11-27");
  });
});

describe("hora de cierre", () => {
  it("dice el día cuando la fiesta termina de madrugada", () => {
    const inicio = new Date("2026-11-28T23:00:00-05:00");
    const cierre = new Date("2026-11-29T06:00:00-05:00");
    expect(formatCloseTime(inicio, cierre)).toBe("6:00 a. m. del domingo 29");
  });

  it("no añade nada si cierra el mismo día", () => {
    const inicio = new Date("2026-11-28T19:00:00-05:00");
    const cierre = new Date("2026-11-28T23:30:00-05:00");
    expect(formatCloseTime(inicio, cierre)).toBe("11:30 p. m.");
  });
});

describe("lo que escribe el local es hora de Lima", () => {
  it("22:00 del 23 de diciembre se guarda como 03:00 UTC del 24", () => {
    // Este era el fallo: el servidor (UTC en Vercel) leia "22:00" como UTC y
    // el panel mostraba 17:00, cinco horas antes.
    expect(limaTimestamp("2026-12-23T22:00")).toBe("2026-12-24T03:00:00.000Z");
  });

  it("y al volver a pintarlo sigue diciendo 22:00 del 23", () => {
    const guardado = limaTimestamp("2026-12-23T22:00")!;
    expect(formatEventDate(new Date(guardado))).toContain("23 de diciembre");
    expect(formatEventDate(new Date(guardado))).toContain("10:00 p. m.");
  });

  it("acepta segundos", () => {
    expect(limaTimestamp("2026-12-23T22:00:30")).toBe("2026-12-24T03:00:30.000Z");
  });

  it("respeta un valor que ya trae zona", () => {
    expect(limaTimestamp("2026-12-24T03:00:00.000Z")).toBe("2026-12-24T03:00:00.000Z");
  });

  it("vacio o invalido devuelve null", () => {
    expect(limaTimestamp("")).toBeNull();
    expect(limaTimestamp(undefined)).toBeNull();
    expect(limaTimestamp("no es una fecha")).toBeNull();
  });
});
