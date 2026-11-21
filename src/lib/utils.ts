import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea centimos como soles peruanos: 7000 -> "S/ 70.00" */
export function formatPEN(cents: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Version corta para tarjetas: 7000 -> "S/ 70" */
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

const DAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

/** "sabado 22 de noviembre · 11:00 p.m." en hora de Lima. */
export function formatEventDate(date: Date | string, opts?: { withTime?: boolean }): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const lima = new Date(d.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const base = `${DAYS[lima.getDay()]} ${lima.getDate()} de ${MONTHS[lima.getMonth()]}`;
  if (opts?.withTime === false) return base;
  return `${base} · ${formatTime(d)}`;
}

/** "11:00 p.m." en hora de Lima. */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-PE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Lima",
  }).format(d);
}

/** "22 nov" para listados compactos. */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(d);
}

/** "en 3 dias" / "manana" / "hoy" */
export function relativeDay(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dayMs = 86_400_000;
  const diff = Math.floor(
    (startOfDayLima(d).getTime() - startOfDayLima(now).getTime()) / dayMs,
  );
  if (diff === 0) return "hoy";
  if (diff === 1) return "manana";
  if (diff < 0) return "finalizado";
  if (diff < 7) return `en ${diff} dias`;
  return formatShortDate(d);
}

function startOfDayLima(d: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return new Date(`${parts}T00:00:00Z`);
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

/** Codigo legible tipo GETIN-9F2KQ4 (sin caracteres ambiguos). */
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
