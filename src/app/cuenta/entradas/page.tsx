import { Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DigitalTicket } from "@/components/tickets/digital-ticket";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState } from "@/components/ui/feedback";
import { isDemoMode } from "@/lib/data/catalog";
import { listMyTickets } from "@/lib/data/orders";
import { relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis entradas", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyTicketsPage() {
  if (isDemoMode()) {
    return (
      <div className="space-y-4">
        <DemoNotice />
        <EmptyState
          icon={Ticket}
          title="Sin entradas en modo demostración"
          description="Las compras necesitan Supabase y un proveedor de pagos configurados. Mientras tanto puedes recorrer el catálogo ficticio."
          action={
            <Button asChild variant="outline">
              <Link href="/eventos">Ver eventos</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const tickets = await listMyTickets();
  const now = new Date();
  // Una entrada sigue siendo util hasta 12 h despues del inicio: los eventos
  // de Lima terminan de madrugada y el dia natural ya cambio.
  const corte = new Date(now.getTime() - 12 * 3_600_000);
  const upcoming = tickets.filter((t) => t.status === "issued" && t.event.startsAt > corte);
  // `listMyTickets` ya devuelve lo mas proximo primero; el historial se lee
  // mejor al contrario, de lo mas reciente a lo mas antiguo.
  const history = tickets.filter((t) => !upcoming.includes(t)).reverse();

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title="Todavía no tienes entradas"
        description="Cuando compres una entrada aparecerá aquí con su código QR, listo para mostrar en la puerta."
        action={
          <Button asChild>
            <Link href="/eventos">Explorar eventos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-10">
      {upcoming.length > 0 ? (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-display text-xl">Próximas</h2>
            <p className="text-xs text-muted">
              {upcoming.length === 1
                ? "1 entrada para usar"
                : `${upcoming.length} entradas para usar`}
              {" · "}
              la primera es {relativeDay(upcoming[0]!.event.startsAt).toLowerCase()}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((ticket) => (
              <DigitalTicket key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section>
          <h2 className="text-display mb-4 text-xl">Utilizadas y pasadas</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {history.map((ticket) => (
              <DigitalTicket key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
