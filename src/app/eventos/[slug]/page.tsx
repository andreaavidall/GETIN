import {
  BadgeCheck,
  CalendarDays,
  Clock,
  Info,
  MapPin,
  Music,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuestListPanel } from "@/components/checkout/guest-list-panel";
import { TablePicker } from "@/components/checkout/table-picker";
import { TicketSelector } from "@/components/checkout/ticket-selector";
import { Badge } from "@/components/ui/badge";
import { DemoNotice } from "@/components/ui/feedback";
import { getSession } from "@/lib/auth/session";
import { getEventBySlug, isDemoMode } from "@/lib/data/catalog";
import { formatEventDate, formatTime } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Evento no encontrado" };

  const description =
    event.tagline ??
    `${event.name} en ${event.venue.name}, ${event.venue.district}. ${formatEventDate(event.startsAt)}.`;

  return {
    title: `${event.name} · ${event.venue.name}`,
    description,
    openGraph: {
      title: `${event.name} · ${event.venue.name}`,
      description,
      images: event.coverUrl ? [{ url: event.coverUrl }] : undefined,
      type: "website",
    },
  };
}

export default async function EventPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [event, session] = await Promise.all([getEventBySlug(slug), getSession()]);
  if (!event) notFound();

  const demo = isDemoMode();

  return (
    <article>
      {/* ---------------------------------------------------------- portada */}
      <header className="relative isolate -mt-16 overflow-hidden pt-16">
        {event.coverUrl ? (
          <Image src={event.coverUrl} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        <div className="absolute inset-0 hero-scrim" />

        <div className="container relative flex min-h-[420px] flex-col justify-end pb-8 pt-16">
          <div className="mb-4 flex flex-wrap gap-2">
            {event.isDemo ? <Badge variant="demo">Evento de demostracion</Badge> : null}
            <Badge variant={event.availability.tone === "soldout" ? "danger" : "lime"}>
              {event.availability.label}
            </Badge>
            <Badge variant="outline">{event.minAge}+</Badge>
          </div>

          <h1 className="text-display max-w-3xl text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
            {event.name}
          </h1>
          {event.tagline ? (
            <p className="mt-3 max-w-xl text-base text-white/70">{event.tagline}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
            <Link
              href={`/discotecas/${event.venue.slug}`}
              className="flex items-center gap-1.5 font-medium hover:text-lime"
            >
              {event.venue.name}
              {event.venue.isVerified ? <BadgeCheck className="size-4 text-lime" /> : null}
            </Link>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-muted" />
              {event.venue.address}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-muted" />
              {formatEventDate(event.startsAt, { withTime: false })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-muted" />
              {formatTime(event.startsAt)}
              {event.endsAt ? ` – ${formatTime(event.endsAt)}` : null}
            </span>
          </div>
        </div>
      </header>

      <div className="container grid gap-10 py-10 lg:grid-cols-[1fr_minmax(340px,420px)]">
        {/* ----------------------------------------------------- contenido */}
        <div className="space-y-10">
          {demo ? <DemoNotice /> : null}

          {event.description ? (
            <section>
              <h2 className="text-display mb-3 text-xl">Sobre el evento</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">
                {event.description}
              </p>
            </section>
          ) : null}

          {event.lineup.length > 0 ? (
            <section>
              <h2 className="text-display mb-3 text-xl">Line-up</h2>
              <ul className="surface divide-y divide-white/5">
                {event.lineup.map((artist) => (
                  <li key={artist.name} className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-lime/10">
                        <Music className="size-4 text-lime" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{artist.name}</p>
                        {artist.role ? (
                          <p className="text-xs text-muted">{artist.role}</p>
                        ) : null}
                      </div>
                    </div>
                    {artist.start ? (
                      <span className="text-xs text-muted">{artist.start}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2">
            <InfoBlock
              icon={Clock}
              title="Horarios"
              rows={[
                event.doorsOpenAt ? ["Apertura de puertas", formatTime(event.doorsOpenAt)] : null,
                ["Inicio", formatTime(event.startsAt)],
                event.lastEntryAt ? ["Ultimo ingreso", formatTime(event.lastEntryAt)] : null,
                event.endsAt ? ["Cierre", formatTime(event.endsAt)] : null,
              ]}
            />
            <InfoBlock
              icon={Users}
              title="Ingreso"
              rows={[
                ["Edad minima", `${event.minAge} años`],
                event.venue.dressCode ? ["Codigo de vestimenta", event.venue.dressCode] : null,
                event.musicGenres.length > 0
                  ? ["Genero musical", event.musicGenres.join(", ")]
                  : null,
              ]}
            />
          </section>

          {event.entryRules ? (
            <section className="surface flex gap-3 p-5">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-400" />
              <div>
                <h2 className="font-display text-base font-semibold">Reglas de ingreso</h2>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{event.entryRules}</p>
                <p className="mt-3 text-xs text-muted">
                  El ingreso depende del aforo autorizado del local y de su derecho de admision.
                  Tu entrada pagada es valida para este evento, pero GETIN no puede garantizar el
                  acceso si el local alcanza su aforo.
                </p>
              </div>
            </section>
          ) : null}

          {event.cancellationPolicy ? (
            <section className="surface flex gap-3 p-5">
              <Info className="mt-0.5 size-5 shrink-0 text-lime" />
              <div>
                <h2 className="font-display text-base font-semibold">Politica de cancelacion</h2>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">
                  {event.cancellationPolicy}
                </p>
                <Link
                  href="/legal/reembolsos"
                  className="mt-2 inline-block text-xs text-lime hover:underline"
                >
                  Ver politica general de reembolsos →
                </Link>
              </div>
            </section>
          ) : null}

          {/* ------------------------------------------------------- mesas */}
          {event.tables.length > 0 ? (
            <section id="mesas" className="scroll-mt-24">
              <h2 className="text-display mb-1 text-xl">Mesas VIP</h2>
              <p className="mb-4 text-sm text-muted">
                Al reservar pagas un adelanto; el saldo y el consumo minimo se abonan en el local.
              </p>
              <TablePicker eventId={event.id} tables={event.tables} canBuy={Boolean(session) && !demo} />
            </section>
          ) : null}

          {/* ------------------------------------------------------ listas */}
          {event.guestLists.length > 0 ? (
            <section id="listas" className="scroll-mt-24">
              <h2 className="text-display mb-1 text-xl">Listas de invitados</h2>
              <p className="mb-4 text-sm text-muted">
                La inscripcion no garantiza el ingreso: depende del cupo, del horario y del
                criterio de admision del local.
              </p>
              <div className="space-y-3">
                {event.guestLists.map((list) => (
                  <GuestListPanel
                    key={list.id}
                    list={list}
                    canJoin={Boolean(session) && !demo}
                    defaultName={session?.user.fullName ?? ""}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="text-display mb-3 text-xl">Ubicacion</h2>
            <div className="surface overflow-hidden">
              <div className="p-5">
                <p className="text-sm font-medium">{event.venue.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {event.venue.address}, {event.venue.district}
                </p>
              </div>
              {event.venue.lat !== null && event.venue.lng !== null ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${event.venue.lat},${event.venue.lng}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-sm text-lime hover:bg-white/[0.03]"
                >
                  Abrir en Google Maps
                  <MapPin className="size-4" />
                </a>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted">
              El mapa interactivo embebido llega en una fase posterior; por ahora el enlace abre la
              ubicacion en el mapa del telefono.
            </p>
          </section>
        </div>

        {/* ------------------------------------------------- panel de compra */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <TicketSelector
            eventId={event.id}
            eventName={event.name}
            ticketTypes={event.ticketTypes}
            isAuthenticated={Boolean(session)}
            demoMode={demo}
            eventSlug={event.slug}
          />
        </aside>
      </div>
    </article>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  rows,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  rows: ([string, string] | null)[];
}) {
  const visible = rows.filter((r): r is [string, string] => r !== null);
  if (visible.length === 0) return null;
  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-lime" />
        <h3 className="font-display text-base font-semibold">{title}</h3>
      </div>
      <dl className="mt-3 space-y-2">
        {visible.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
