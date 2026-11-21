import { CalendarDays, MapPin, QrCode } from "lucide-react";
import QRCode from "qrcode";

import { Badge } from "@/components/ui/badge";
import { formatEventDate, formatTime } from "@/lib/utils";
import type { TicketView } from "@/lib/data/orders";

/**
 * Ticket digital.
 *
 * El QR se genera en el servidor (nunca se envia el secreto al navegador) y se
 * incrusta como data URL. El contenido es el token firmado: no lleva nombre,
 * correo ni documento, de modo que una foto del QR filtrada no expone datos
 * personales, solo la credencial, que ademas se invalida al usarse.
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

  return (
    <article className="surface overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-dashed border-white/15 p-5">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-lime">{ticket.typeName}</p>
          <h3 className="mt-1 truncate font-display text-lg font-bold">{ticket.event.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <MapPin className="size-3" />
            {ticket.event.venueName} · {ticket.event.district}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <CalendarDays className="size-3" />
            {formatEventDate(ticket.event.startsAt)}
          </p>
        </div>
        <Badge variant={used ? "outline" : past ? "outline" : "success"}>
          {used ? "Utilizada" : past ? "Finalizado" : "Valida"}
        </Badge>
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
                alt={`Codigo QR de la entrada ${ticket.serial}`}
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
              <p className="text-center text-xs text-muted">
                Muestra este codigo en la puerta. Es de un solo uso.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <QrCode className="size-8 text-muted" />
            <p className="text-sm text-muted">
              {ticket.status === "refunded"
                ? "Entrada reembolsada: el codigo fue anulado."
                : ticket.status === "cancelled"
                  ? "Entrada anulada."
                  : "El codigo se genera cuando el pago queda confirmado."}
            </p>
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
        {ticket.event.lastEntryAt ? (
          <p className="col-span-2 text-[11px] text-muted">
            Ultimo ingreso: {formatTime(ticket.event.lastEntryAt)}. El acceso depende del aforo
            autorizado del local.
          </p>
        ) : null}
      </footer>
    </article>
  );
}
