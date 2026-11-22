import {
  BarChart3,
  CalendarPlus,
  ClipboardList,
  Download,
  QrCode,
  Ticket,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EventPublishToggle } from "@/components/club/event-publish-toggle";
import { GuestEntryDecisions } from "@/components/club/guest-entry-decisions";
import { NewEventForm } from "@/components/club/new-event-form";
import { TicketTypeManager } from "@/components/club/ticket-type-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireActiveVenue } from "@/lib/auth/guards";
import {
  getVenueStats,
  listPendingGuestEntries,
  listVenueEvents,
} from "@/lib/data/club";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEventDate, formatPEN } from "@/lib/utils";

export const metadata: Metadata = { title: "Panel del local", robots: { index: false } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ local?: string }>;

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  published: { label: "Publicado", variant: "success" },
  draft: { label: "Borrador", variant: "warning" },
  cancelled: { label: "Cancelado", variant: "outline" },
  finished: { label: "Finalizado", variant: "outline" },
};

export default async function ClubDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { local } = await searchParams;
  const { session, venueId, venueIds } = await requireActiveVenue(local);

  const supabase = await createSupabaseServerClient();
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, district, status, is_verified")
    .in("id", venueIds);

  const list = (venues ?? []) as {
    id: string;
    name: string;
    district: string;
    status: string;
    is_verified: boolean;
  }[];
  const venue = list.find((v) => v.id === venueId);

  const [stats, events, pendingGuests] = await Promise.all([
    getVenueStats(venueId),
    listVenueEvents(venueId),
    listPendingGuestEntries(venueId),
  ]);

  return (
    <div className="container space-y-8 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display text-3xl">{venue?.name ?? "Panel del local"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {venue?.district}
            {venue ? (
              <Badge variant={venue.status === "approved" ? "success" : "warning"}>
                {venue.status === "approved" ? "Aprobado" : "Pendiente de aprobación"}
              </Badge>
            ) : null}
            {venue?.is_verified ? <Badge variant="lime">Verificado</Badge> : null}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/puerta">
              <QrCode className="size-4" />
              Control de puerta
            </Link>
          </Button>
        </div>
      </header>

      {list.length > 1 ? (
        <nav className="flex flex-wrap gap-2">
          {list.map((v) => (
            <Link
              key={v.id}
              href={`/club/dashboard?local=${v.id}`}
              className={`rounded-xl px-3 py-1.5 text-xs ${
                v.id === venueId ? "bg-lime font-semibold text-ink" : "bg-white/5 text-muted"
              }`}
            >
              {v.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {venue?.status !== "approved" ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-4 text-sm text-amber-100/90">
          <strong className="font-semibold">Tu local aún no esta aprobado.</strong> Puedes preparar
          tus eventos y entradas, pero no apareceran en el catálogo publico ni se podran comprar
          hasta que el equipo de GETIN verifique la información comercial.
        </div>
      ) : null}

      {/* --------------------------------------------------------- resumen */}
      <section>
        <h2 className="text-display mb-4 flex items-center gap-2 text-xl">
          <BarChart3 className="size-5 text-lime" />
          Resumen
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Ventas de hoy" value={formatPEN(stats.todayGrossCents)} hint={`${stats.todayOrders} ordenes`} />
          <Stat label="Entradas vendidas" value={String(stats.ticketsSold)} icon={Ticket} />
          <Stat label="Mesas reservadas" value={String(stats.tablesReserved)} />
          <Stat label="Asistentes registrados" value={String(stats.checkins)} icon={Users} />
          <Stat label="Ingresos brutos" value={formatPEN(stats.grossCents)} />
          <Stat label="Comisión GETIN" value={formatPEN(stats.getinFeeCents)} />
          <Stat
            label="Ingreso neto estimado"
            value={formatPEN(stats.netEstimateCents)}
            hint="Antes de la liquidación"
          />
          <Stat label="Invitados confirmados" value={String(stats.guestsConfirmed)} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Las cifras se calculan sobre ordenes efectivamente pagadas. El ingreso neto es una
          estimacion previa a la liquidación: el reparto definitivo depende del proveedor de pagos
          y del acuerdo comercial.
        </p>
      </section>

      {/* -------------------------------------------------- listas pendientes */}
      {pendingGuests.length > 0 ? (
        <section>
          <h2 className="text-display mb-4 flex items-center gap-2 text-xl">
            <ClipboardList className="size-5 text-lime" />
            Solicitudes de lista ({pendingGuests.length})
          </h2>
          <GuestEntryDecisions venueId={venueId} entries={pendingGuests} />
        </section>
      ) : null}

      {/* --------------------------------------------------------- eventos */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-display flex items-center gap-2 text-xl">
            <CalendarPlus className="size-5 text-lime" />
            Eventos
          </h2>
        </div>

        <NewEventForm venueId={venueId} />

        <div className="mt-4 space-y-4">
          {events.length === 0 ? (
            <EmptyState
              title="Aún no has creado ningún evento"
              description="Crea tu primer evento, configura sus entradas y publicalo cuando este listo."
            />
          ) : (
            events.map((event) => {
              const status = STATUS[event.status] ?? { label: event.status, variant: "outline" as const };
              const sold = event.ticketTypes.reduce((acc, t) => acc + t.soldCount, 0);
              const capacity = event.ticketTypes.reduce((acc, t) => acc + t.capacity, 0);

              return (
                <article key={event.id} className="surface overflow-hidden">
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold">{event.name}</h3>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {formatEventDate(event.startsAt)} · {sold}/{capacity} entradas
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {event.status === "published" ? (
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/eventos/${event.slug}`}>Ver página</Link>
                        </Button>
                      ) : null}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/club/dashboard/asistentes/${event.id}`}>
                          <Download className="size-4" />
                          Asistentes
                        </Link>
                      </Button>
                      <EventPublishToggle
                        venueId={venueId}
                        eventId={event.id}
                        published={event.status === "published"}
                      />
                    </div>
                  </header>

                  <TicketTypeManager
                    venueId={venueId}
                    eventId={event.id}
                    ticketTypes={event.ticketTypes}
                  />
                </article>
              );
            })
          )}
        </div>
      </section>

      <p className="text-xs text-muted">
        Sesión de {session.user.email}. Las operaciones sobre pagos confirmados no se pueden
        modificar desde este panel: quedan registradas en la auditoria de GETIN.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
        {Icon ? <Icon className="size-4 text-muted" /> : null}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
