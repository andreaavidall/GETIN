"use client";

import { CalendarPlus, Check, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatEventDate } from "@/lib/utils";

/**
 * Compartir un evento y añadirlo al calendario.
 *
 * WhatsApp es el canal por el que se reparte de verdad un plan de noche en
 * Lima, así que tiene su propio botón además del menú nativo del sistema.
 *
 * El archivo .ics se arma en el navegador con las fechas reales del evento, en
 * UTC: así cualquier calendario lo coloca a la hora correcta sin depender de
 * la zona horaria del teléfono.
 */
function toICSDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function EventActions({
  name,
  venueName,
  address,
  startsAt,
  endsAt,
  className,
}: {
  name: string;
  venueName: string;
  address: string;
  startsAt: string;
  endsAt?: string | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 4 * 3_600_000);
  const cuando = formatEventDate(start);

  function url(): string {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  function mensaje(): string {
    return `${name} · ${venueName}\n${cuando}\n\n${url()}`;
  }

  async function compartir() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${name} · ${venueName}`, text: `${name}. ${cuando}.`, url: url() });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No pudimos copiar el enlace");
    }
  }

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje())}`, "_blank", "noopener");
  }

  function calendario() {
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
      `DESCRIPTION:${escapeICS(`${name} en ${venueName}. Entradas en ${url()}`)}`,
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
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      <Button variant="secondary" size="sm" onClick={compartir}>
        {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
        {copied ? "Copiado" : "Compartir"}
      </Button>
      <Button variant="secondary" size="sm" onClick={whatsapp}>
        {/* Icono de WhatsApp: lucide no lo trae, así que va como SVG. */}
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.8 11.8 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.9 11.9 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.8 11.8 0 0 0-3.48-8.413" />
        </svg>
        WhatsApp
      </Button>
      <Button variant="secondary" size="sm" onClick={calendario}>
        <CalendarPlus className="size-4" />
        Calendario
      </Button>
    </div>
  );
}
