"use client";

import { CalendarPlus, Check, Copy, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn, formatEventDate } from "@/lib/utils";

/**
 * Acciones sociales de un evento.
 *
 * Antes eran cuatro botones sueltos —Guardar, Compartir, WhatsApp,
 * Calendario, Armar plan— que ocupaban tres filas ENCIMA del título. Lo
 * primero que veía alguien al abrir una fiesta no era la fiesta.
 *
 * Ahora Compartir es uno solo y abre un menú con WhatsApp y copiar enlace
 * dentro; Calendario vive aparte, en la zona secundaria, para no competir
 * con el botón de comprar.
 *
 * El .ics se arma en el navegador con las fechas reales del evento, en UTC,
 * para que cualquier calendario lo coloque a la hora correcta.
 */
function toICSDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

type Props = {
  name: string;
  venueName: string;
  address: string;
  startsAt: string;
  endsAt?: string | null;
  className?: string;
};

export function ShareMenu({ name, venueName, startsAt, className }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const cuando = formatEventDate(new Date(startsAt));

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  function url(): string {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  async function compartir() {
    // En el móvil la hoja nativa es mejor que cualquier menú propio: lleva a
    // la aplicación que de verdad usa cada persona.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${name} · ${venueName}`, text: `${name}. ${cuando}.`, url: url() });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    setAbierto((v) => !v);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url());
      setCopiado(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiado(false), 2500);
      setAbierto(false);
    } catch {
      toast.error("No pudimos copiar el enlace");
    }
  }

  function whatsapp() {
    const texto = `${name} · ${venueName}\n${cuando}\n\n${url()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    setAbierto(false);
  }

  return (
    <div ref={caja} className={cn("relative", className)}>
      <button
        type="button"
        onClick={compartir}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 text-sm font-medium backdrop-blur transition-colors duration-200 hover:border-white/30"
      >
        <Share2 className="size-4" aria-hidden="true" />
        Compartir
      </button>

      {abierto ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-[var(--radius)] border border-white/15 bg-surface shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={whatsapp}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors duration-150 hover:bg-white/[0.06]"
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.8 11.8 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.9 11.9 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.8 11.8 0 0 0-3.48-8.413" />
            </svg>
            Enviar por WhatsApp
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={copiar}
            className="flex w-full items-center gap-2.5 border-t border-white/10 px-4 py-3 text-left text-sm transition-colors duration-150 hover:bg-white/[0.06]"
          >
            {copiado ? (
              <Check className="size-4 shrink-0 text-lime" aria-hidden="true" />
            ) : (
              <Copy className="size-4 shrink-0" aria-hidden="true" />
            )}
            {copiado ? "Copiado" : "Copiar enlace"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Añadir al calendario. Acción secundaria: no compite con comprar. */
export function CalendarButton({ name, venueName, address, startsAt, endsAt }: Props) {
  function descargar() {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 4 * 3_600_000);
    const url = typeof window !== "undefined" ? window.location.href : "";

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//GETIN//ES",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${start.getTime()}@getin.pe`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${escapeICS(name)}`,
      `LOCATION:${escapeICS(`${venueName}, ${address}`)}`,
      `DESCRIPTION:${escapeICS(`${name} en ${venueName}. Entradas en ${url}`)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.ics`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(enlace.href);
    toast.success("Evento descargado", { description: "Ábrelo para añadirlo a tu calendario." });
  }

  return (
    <button
      type="button"
      onClick={descargar}
      className="flex items-center gap-2 text-sm text-muted transition-colors duration-200 hover:text-paper"
    >
      <CalendarPlus className="size-4" aria-hidden="true" />
      Añadir al calendario
    </button>
  );
}
