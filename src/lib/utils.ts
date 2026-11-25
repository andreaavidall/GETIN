import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea céntimos como soles peruanos: 7000 -> "S/ 70.00" */
export function formatPEN(cents: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Versión corta para tarjetas: 7000 -> "S/ 70" */
export function formatPENShort(cents: number): string {
  const soles = cents / 100;
  const hasCents = Math.round(cents) % 100 !== 0;
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(soles);
}

/* ===========================================================================
 * Fechas
 *
 * TODA fecha que ve el usuario se formatea en America/Lima, pase lo que pase
 * en el servidor. Esto nació de un fallo real: «Próximos eventos» usaba
 * `getDate()` sin zona horaria, así que en Vercel (que corre en UTC) un evento
 * de las 23:00 de Lima se mostraba con la fecha del día siguiente. El mismo
 * evento aparecía como 27 en una sección y como 28 en otra.
 *
 * La regla, para que no vuelva a pasar: nadie llama a getDate(), getDay(),
 * getMonth() ni toLocaleDateString() sobre un evento. Se usan estos ayudantes.
 * =========================================================================== */

export const LIMA_TZ = "America/Lima";

/** Perú no cambia de hora: UTC-5 todo el año. */
export const LIMA_OFFSET = "-05:00";

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "set", "oct", "nov", "dic",
];

type LimaParts = { year: number; month: number; day: number; weekday: number };

/** Año, mes, día y día de la semana de una fecha, vistos desde Lima. */
export function limaParts(date: Date | string): LimaParts {
  const d = typeof date === "string" ? new Date(date) : date;
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .split("-")
    .map(Number) as [number, number, number];

  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: LIMA_TZ,
    weekday: "short",
  }).format(d);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);

  return { year: y, month: m, day, weekday };
}

/** Medianoche de Lima del día de esa fecha, como instante absoluto. */
export function limaStartOfDay(date: Date | string = new Date()): Date {
  const { year, month, day } = limaParts(date);
  // Perú no aplica horario de verano: siempre UTC-5.
  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00-05:00`,
  );
}

/** Día de la semana en Lima (0 = domingo). */
export function limaDayOfWeek(date: Date | string = new Date()): number {
  return limaParts(date).weekday;
}

/** Número de día del mes en Lima. Para las fichas compactas. */
export function limaDayNumber(date: Date | string): number {
  return limaParts(date).day;
}

/** Mes abreviado en Lima: "nov". */
export function limaMonthShort(date: Date | string): string {
  return MONTHS_SHORT[limaParts(date).month - 1] ?? "";
}

/** "sábado 28 de noviembre · 11:00 p. m." en hora de Lima. */
export function formatEventDate(date: Date | string, opts?: { withTime?: boolean }): string {
  const { weekday, day, month } = limaParts(date);
  const base = `${DAYS[weekday]} ${day} de ${MONTHS[month - 1]}`;
  if (opts?.withTime === false) return base;
  return `${base} · ${formatTime(date)}`;
}

/**
 * Rango completo del evento, diciendo el día de cierre cuando termina al día
 * siguiente. Una fiesta que empieza el sábado y acaba el domingo tiene que
 * verse así, o la gente cree que cierra a las 6 de la mañana del mismo sábado.
 */
export function formatEventRange(start: Date | string, end?: Date | string | null): string {
  const base = formatEventDate(start);
  if (!end) return base;

  const s = limaParts(start);
  const e = limaParts(end);
  const sameDay = s.year === e.year && s.month === e.month && s.day === e.day;

  if (sameDay) return `${base} – ${formatTime(end)}`;
  return `${base} – ${DAYS[e.weekday]} ${e.day}, ${formatTime(end)}`;
}

/**
 * Hora de cierre, con el día si el evento termina al día siguiente.
 *
 * "6:00 a. m." a secas hace pensar en la mañana del mismo día. Una fiesta de
 * Lima que empieza a las 23:00 cierra el domingo, y eso hay que decirlo donde
 * se lee la hora, no solo en el rango completo.
 */
export function formatCloseTime(start: Date | string, end: Date | string): string {
  const s = limaParts(start);
  const e = limaParts(end);
  const sameDay = s.year === e.year && s.month === e.month && s.day === e.day;
  if (sameDay) return formatTime(end);
  return `${formatTime(end)} del ${DAYS[e.weekday]} ${e.day}`;
}

/**
 * Convierte lo que escribe un `<input type="datetime-local">` en un instante,
 * interpretándolo SIEMPRE como hora de Lima.
 *
 * Esto arreglaba un desfase de cinco horas: el valor del input no lleva zona
 * ("2026-12-23T22:00") y `new Date()` lo interpreta en la zona de quien
 * ejecuta el código. Como quien lo ejecuta es el servidor —y en Vercel el
 * servidor va en UTC—, las 22:00 que escribía el local se guardaban como
 * 22:00 UTC, o sea las 17:00 de Lima.
 *
 * Perú es UTC-5 todo el año, así que basta con fijar el desfase. Si algún día
 * GETIN sale de Perú, esto tendrá que mirar la zona del local.
 */
export function limaTimestamp(value: string | undefined | null): string | null {
  if (!value) return null;

  // "2026-12-23T22:00" o "2026-12-23T22:00:00". Si ya trae zona (acaba en Z o
  // en +hh:mm) se respeta: viene de otro sitio, no del formulario.
  const sinZona = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value.trim());
  const texto = sinZona
    ? `${value.trim()}${value.trim().length === 16 ? ":00" : ""}${LIMA_OFFSET}`
    : value;

  const date = new Date(texto);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "11:00 p. m." en hora de Lima. */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-PE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: LIMA_TZ,
  }).format(d);
}

/** "28 nov" para listados compactos. */
export function formatShortDate(date: Date | string): string {
  return `${limaParts(date).day} ${limaMonthShort(date)}`;
}

/** "en 3 días" / "mañana" / "hoy" */
export function relativeDay(date: Date | string, now: Date = new Date()): string {
  const diff = Math.round(
    (limaStartOfDay(date).getTime() - limaStartOfDay(now).getTime()) / 86_400_000,
  );
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff < 0) return "finalizado";
  if (diff < 7) return `en ${diff} días`;
  return formatShortDate(date);
}

/** Fecha en formato YYYY-MM-DD de Lima, para los parámetros de la URL. */
export function limaISODate(date: Date | string = new Date()): string {
  const { year, month, day } = limaParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Convierte un texto en slug url-safe. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Código legible tipo GETIN-9F2KQ4 (sin caracteres ambiguos). */
export function readableCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== "undefined") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < length; i++) {
    out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  }
  return out;
}

export function minutesUntil(date: Date | string, now: Date = new Date()): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.max(Math.ceil((d.getTime() - now.getTime()) / 60_000), 0);
}
