import { Sofa } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState } from "@/components/ui/feedback";
import { isDemoMode } from "@/lib/data/catalog";
import { listMyReservations } from "@/lib/data/orders";
import { formatEventDate, formatPEN } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis mesas", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "outline" | "danger" }> = {
  confirmed: { label: "Confirmada", variant: "success" },
  pending: { label: "Pendiente", variant: "warning" },
  completed: { label: "Utilizada", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "danger" },
  no_show: { label: "No asistio", variant: "danger" },
};

export default async function MyTablesPage() {
  if (isDemoMode()) {
    return (
      <div className="space-y-4">
        <DemoNotice />
        <EmptyState icon={Sofa} title="Sin reservas en modo demostracion" />
      </div>
    );
  }

  const reservations = await listMyReservations();

  if (reservations.length === 0) {
    return (
      <EmptyState
        icon={Sofa}
        title="Todavia no tienes mesas reservadas"
        description="Al reservar una mesa pagas un adelanto y el saldo se abona en el local."
        action={
          <Button asChild>
            <Link href="/eventos">Ver eventos con mesas</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {await Promise.all(
        reservations.map(async (reservation) => {
          const qr = reservation.qrToken
            ? await QRCode.toDataURL(reservation.qrToken, { margin: 1, width: 360 })
            : null;
          const status = STATUS[reservation.status] ?? {
            label: reservation.status,
            variant: "outline" as const,
          };

          return (
            <article key={reservation.id} className="surface overflow-hidden">
              <header className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-lime">
                    {reservation.tableLabel}
                    {reservation.zone ? ` · ${reservation.zone}` : ""}
                  </p>
                  <h2 className="mt-1 font-display text-lg font-semibold">
                    {reservation.event.name}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {reservation.event.venueName} · {formatEventDate(reservation.event.startsAt)}
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </header>

              <dl className="space-y-2 p-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Total de la mesa</dt>
                  <dd>{formatPEN(reservation.totalCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Adelanto pagado</dt>
                  <dd className="text-lime">{formatPEN(reservation.depositPaidCents)}</dd>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2">
                  <dt className="font-medium">Saldo en el local</dt>
                  <dd className="font-semibold">{formatPEN(reservation.balanceDueCents)}</dd>
                </div>
              </dl>

              {reservation.conditions ? (
                <p className="px-5 pb-4 text-[11px] text-muted">{reservation.conditions}</p>
              ) : null}

              {qr ? (
                <div className="flex flex-col items-center gap-2 border-t border-dashed border-white/15 p-5">
                  <div className="rounded-xl bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="Codigo QR de la reserva" width={168} height={168} />
                  </div>
                  <p className="text-[11px] text-muted">Muestra este codigo al llegar</p>
                </div>
              ) : null}
            </article>
          );
        }),
      )}
    </div>
  );
}
