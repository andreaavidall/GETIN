import { CalendarDays, Clock, Info, MapPin, QrCode } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";

import { QrZoom } from "@/components/tickets/qr-zoom";
import { Badge } from "@/components/ui/badge";
import { formatEventDate, formatTime } from "@/lib/utils";
import type { TicketView } from "@/lib/data/orders";

/**
 * Ticket digital.
 *
 * El QR se genera en el servidor (nunca se envia el secreto al navegador) y se
 * incrusta como data URL. El contenido es el token firmado: no lleva nombre,
 * correo ni documento, de modo que una foto del QR filtrada no expone datos
 * personales, solo la credencial, que además se inválida al usarse.
 *
 * El QR se dibuja grande a proposito: se lee en la puerta, de noche, con la
 * pantalla sucia y poca luz.
 */
export async function DigitalTicket({ ticket }: { ticket: TicketView }) {
  const qrDataUrl = ticket.qrToken
    ? await QRCode.toDataURL(ticket.qrToken, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 520,
        color: { dark: "#000000", light: "#FFFFFF" },
      })
    : null;

  const used = ticket.status === "used";
  const past = ticket.event.startsAt < new Date(Date.now() - 12 * 3_600_000);
  const unpaid = ticket.orderStatus !== "paid";

  // Un solo sitio decide el estado que se muestra: antes el badge decia
  // "Valida" aunque la orden no estuviera pagada y el QR no existiera.
  const estado: { label: string; variant: "success" | "outline" | "warning" | "danger" } =
    ticket.status === "refunded"
      ? { label: "Reembolsada", variant: "outline" }
      : ticket.status === "cancelled"
        ? { label: "Anulada", variant: "danger" }
        : used
          ? { label: "Utilizada", variant: "outline" }
          : unpaid
            ? { label: "Pago pendiente", variant: "warning" }
            : past
              ? { label: "Finalizado", variant: "outline" }
              : { label: "Válida", variant: "success" };

  return (
    <article className="surface overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-dashed border-white/15 p-5">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-lime">{ticket.typeName}</p>
          <h3 className="mt-1 truncate font-display text-lg font-bold">
            <Link href={`/eventos/${ticket.event.slug}`} className="hover:text-lime">
              {ticket.event.name}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">
              {ticket.event.venueName} · {ticket.event.address}, {ticket.event.district}
            </span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <CalendarDays className="size-3 shrink-0" />
            {formatEventDate(ticket.event.startsAt)}
          </p>
        </div>
        <Badge variant={estado.variant}>{estado.label}</Badge>
      </header>

      <div className="flex flex-col items-center gap-4 p-6">
        {qrDataUrl ? (
          <>
            <div
              className={`rounded-2xl bg-white p-3 ${used ? "opacity-35 grayscale" : ""}`}
              aria-hidden={used}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`Código QR de la entrada ${ticket.serial}`}
                width={240}
                height={240}
                className="size-[240px]"
              />
            </div>
            {used ? (
              <p className="text-sm font-semibold text-muted">
                Esta entrada ya fue utilizada
                {ticket.usedAt ? ` a las ${formatTime(ticket.usedAt)}` : ""}.
              </p>
            ) : (
              <>
                <QrZoom
                  src={qrDataUrl}
                  alt={`Código QR de la entrada ${ticket.serial}`}
                  serial={ticket.serial}
                />
                <p className="text-center text-xs text-muted">
                  Muestra este código en la puerta. Es de un solo uso.
                </p>
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <QrCode className="size-8 text-muted" />
            <p className="text-sm text-muted">
              {ticket.status === "refunded"
                ? "Entrada reembolsada: el código fue anulado."
                : ticket.status === "cancelled"
                  ? "Entrada anulada."
                  : "El código se genera cuando el pago queda confirmado."}
            </p>
            {unpaid && ticket.status === "issued" ? (
              <Link href="/cuenta/compras" className="text-xs text-lime hover:underline">
                Ver el estado de la compra
              </Link>
            ) : null}
          </div>
        )}
      </div>

      <footer className="grid grid-cols-2 gap-3 border-t border-dashed border-white/15 p-5 text-xs">
        <div>
          <p className="text-muted">Serie</p>
          <p className="mt-0.5 font-mono text-paper">{ticket.serial}</p>
        </div>
        <div className="text-right">
          <p className="text-muted">Orden</p>
          <p className="mt-0.5 font-mono text-paper">{ticket.orderCode}</p>
        </div>
        {ticket.holderName ? (
          <div className="col-span-2 border-t border-white/5 pt-3">
            <p className="text-muted">A nombre de</p>
            <p className="mt-0.5">{ticket.holderName}</p>
          </div>
        ) : null}
      </footer>

      {/* Condiciones en la propia entrada: en la puerta nadie abre otra
          página para comprobar la edad mínima o la vestimenta. */}
      <div className="space-y-1.5 border-t border-white/10 bg-white/[0.02] p-5 text-[11px] text-muted">
        <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wide">
          <Info className="size-3 text-lime" />
          Condiciones de ingreso
        </p>
        <p>
          Edad mínima <strong className="text-paper">{ticket.event.minAge} años</strong>; lleva
          DNI o carné de extranjería.
        </p>
        {ticket.event.dressCode ? <p>Vestimenta: {ticket.event.dressCode}</p> : null}
        {ticket.event.lastEntryAt ? (
          <p className="flex items-center gap-1.5">
            <Clock className="size-3" />
            Último ingreso a las {formatTime(ticket.event.lastEntryAt)} — después de esa hora el
            local puede no dejarte pasar.
          </p>
        ) : null}
        <p>
          El acceso depende del aforo autorizado del local. Si no puedes entrar con tu entrada
          pagada,{" "}
          <Link href="/legal/reembolsos" className="text-lime hover:underline">
            te devolvemos el importe
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
