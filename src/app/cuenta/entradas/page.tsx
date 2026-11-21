import { Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DigitalTicket } from "@/components/tickets/digital-ticket";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState } from "@/components/ui/feedback";
import { isDemoMode } from "@/lib/data/catalog";
import { listMyTickets } from "@/lib/data/orders";

export const metadata: Metadata = { title: "Mis entradas", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyTicketsPage() {
  if (isDemoMode()) {
    return (
      <div className="space-y-4">
        <DemoNotice />
        <EmptyState
          icon={Ticket}
          title="Sin entradas en modo demostracion"
          description="Las compras necesitan Supabase y un proveedor de pagos configurados. Mientras tanto puedes recorrer el catalogo ficticio."
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
  const upcoming = tickets.filter(
    (t) => t.status === "issued" && t.event.startsAt > new Date(now.getTime() - 12 * 3_600_000),
  );
  const history = tickets.filter((t) => !upcoming.includes(t));

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title="Todavia no tienes entradas"
        description="Cuando compres una entrada aparecera aqui con su codigo QR, listo para mostrar en la puerta."
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
          <h2 className="text-display mb-4 text-xl">Proximas</h2>
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
