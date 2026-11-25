import { BadgeCheck, CalendarDays, Clock, MapPin, Music, ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CalendarButton, ShareMenu } from "@/components/catalog/event-actions";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { SectionNav, type Seccion } from "@/components/catalog/section-nav";
import { PromotionList, VenueFacts, VenueGallery } from "@/components/catalog/venue-details";
import { CreatePlan } from "@/components/plans/create-plan";
import { GuestListPanel } from "@/components/checkout/guest-list-panel";
import { TablePicker } from "@/components/checkout/table-picker";
import { TicketSelector } from "@/components/checkout/ticket-selector";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/ui/cover-image";
import { Disclosure } from "@/components/ui/disclosure";
import { DemoNotice } from "@/components/ui/feedback";
import { getSession } from "@/lib/auth/session";
import { getEventBySlug, isDemoMode } from "@/lib/data/catalog";
import { getFavoriteIds } from "@/lib/data/favorites";
import { getWaitlistIds } from "@/lib/data/waitlist";
import { formatCloseTime, formatEventDate, formatPENShort, formatTime } from "@/lib/utils";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ ref?: string | string[] }>;

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

/**
 * Ficha de evento.
 *
 * El orden de la cabecera es el de las preguntas que se hace quien entra:
 * qué es, cuándo y dónde, cuánto cuesta y cómo lo compro. Guardar y compartir
 * son acciones secundarias y van compactas; antes ocupaban tres filas por
 * encima del título, de modo que lo primero que se veía de una fiesta no era
 * la fiesta.
 *
 * Debajo, una barra de secciones lleva directamente a Entradas o Mesas sin
 * tener que recorrer la descripción entera en el móvil.
 */
export default async function EventPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug } = await params;

  // Etiqueta del enlace por el que se llego (?ref=instagram). Se sanea aqui
  // y se guarda con la orden: sirve para que el local sepa que canal le
  // funciona. No se guarda nada mas del navegador.
  const { ref } = await searchParams;
  const crudo = Array.isArray(ref) ? ref[0] : ref;
  const origen = crudo && /^[a-zA-Z0-9_-]{1,40}$/.test(crudo) ? crudo : undefined;

  const [event, session, favoritos] = await Promise.all([
    getEventBySlug(slug),
    getSession(),
    getFavoriteIds(),
  ]);
  if (!event) notFound();

  const demo = isDemoMode();
  const espera = await getWaitlistIds(event.id);

  const hayMesas = event.tables.length > 0;
  const hayListas = event.guestLists.length > 0;

  const secciones: Seccion[] = [
    { id: "entradas", label: "Entradas" },
    ...(hayMesas ? [{ id: "mesas", label: "Mesas VIP" }] : []),
    ...(hayListas ? [{ id: "listas", label: "Listas" }] : []),
    { id: "informacion", label: "Información" },
    { id: "ubicacion", label: "Ubicación" },
  ];

  const agotado = event.availability.tone === "soldout";

  return (
    <article>
      {/* ---------------------------------------------------------- portada */}
      <header className="relative isolate -mt-16 overflow-hidden pt-16">
        <CoverImage
          src={event.coverUrl}
          alt=""
          name={event.name}
          priority
          sizes="100vw"
          scrim={false}
        />
        {/* Oscurecimiento propio del hero: mas alto que el de una tarjeta
            porque aqui hay mas texto encima. */}
        <div className="hero-scrim absolute inset-0" />

        <div className="container relative flex min-h-[340px] flex-col justify-end pb-6 pt-10 sm:min-h-[400px]">
          {/* Estados que cambian la decision, no etiquetas de relleno. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {event.isDemo ? <Badge variant="demo">Evento de demostración</Badge> : null}
            {agotado ? <Badge variant="danger">Agotado</Badge> : null}
            <Badge variant="outline">{event.minAge}+</Badge>
          </div>

          {/* 1 · Que es */}
          <h1 className="t-hero max-w-3xl">{event.name}</h1>
          {event.tagline ? (
            <p className="mt-2 max-w-xl text-base text-white/75">{event.tagline}</p>
          ) : null}

          {/* 2 · Cuando y donde */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-white/85">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-lime" aria-hidden="true" />
              {formatEventDate(event.startsAt, { withTime: false })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-lime" aria-hidden="true" />
              {formatTime(event.startsAt)}
              {event.endsAt ? ` – ${formatCloseTime(event.startsAt, event.endsAt)}` : null}
            </span>
            <Link
              href={`/discotecas/${event.venue.slug}`}
              className="flex items-center gap-1.5 font-medium underline-offset-4 hover:text-lime hover:underline"
            >
              <MapPin className="size-4 text-lime" aria-hidden="true" />
              {event.venue.name}
              {event.venue.isVerified && !event.isDemo ? (
                <BadgeCheck className="size-4 text-lime" aria-label="Local verificado" />
              ) : null}
            </Link>
          </div>

          {/* 3 · Precio y acceso a la compra */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            {event.priceFromCents !== null ? (
              <p>
                <span className="t-label block text-white/70">Entradas desde</span>
                <span className="font-display text-2xl font-bold text-lime">
                  {formatPENShort(event.priceFromCents)}
                </span>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <a
                href="#entradas"
                className="control-h flex items-center rounded-[var(--radius)] bg-lime px-5 text-sm font-semibold text-ink transition-opacity duration-200 hover:opacity-90"
              >
                Ver entradas
              </a>
              {hayMesas ? (
                <a
                  href="#mesas"
                  className="control-h flex items-center rounded-[var(--radius)] border border-white/20 px-5 text-sm font-semibold backdrop-blur transition-colors duration-200 hover:border-lime/50 hover:text-lime"
                >
                  Mesas VIP
                </a>
              ) : null}
            </div>

            {/* 4 · Acciones secundarias, compactas y al margen de la compra. */}
            <div className="ml-auto flex items-center gap-2">
              {demo ? null : (
                <FavoriteButton
                  target="event"
                  id={event.id}
                  initial={favoritos.events.has(event.id)}
                  isAuthenticated={Boolean(session)}
                  next={`/eventos/${event.slug}`}
                />
              )}
              <ShareMenu
                name={event.name}
                venueName={event.venue.name}
                address={`${event.venue.address}, ${event.venue.district}`}
                startsAt={event.startsAt.toISOString()}
                endsAt={event.endsAt ? event.endsAt.toISOString() : null}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="container">
        <SectionNav sections={secciones} />
      </div>

      {/* pb-28 en movil: deja sitio a la barra inferior de compra. */}
      <div className="container grid gap-10 pb-28 pt-8 lg:grid-cols-[1fr_minmax(340px,400px)] lg:pb-12">
        {/* ----------------------------------------------------- contenido */}
        <div className="min-w-0 space-y-10">
          {demo ? <DemoNotice /> : null}

          {/* En movil las entradas van ARRIBA del todo: es a lo que se viene.
              En escritorio siguen en la columna lateral. */}
          <section id="entradas" className="scroll-mt-28 lg:hidden">
            <TicketSelector
              eventId={event.id}
              eventName={event.name}
              ticketTypes={event.ticketTypes}
              isAuthenticated={Boolean(session)}
              demoMode={demo}
              eventSlug={event.slug}
              minAge={event.minAge}
              dressCode={event.venue.dressCode}
              lastEntryAt={event.lastEntryAt}
              waitingTicketTypes={[...espera.ticketTypes]}
              source={origen}
            />
          </section>

          {/* ------------------------------------------------------- mesas */}
          {hayMesas ? (
            <section id="mesas" className="scroll-mt-28">
              <h2 className="t-section mb-1">Mesas VIP</h2>
              <p className="t-meta mb-4">
                Al reservar pagas un adelanto; el saldo y el consumo mínimo se abonan en el local.
              </p>
              <TablePicker
                eventId={event.id}
                eventSlug={event.slug}
                tables={event.tables}
                isAuthenticated={Boolean(session)}
                demoMode={demo}
                waitingTables={[...espera.tables]}
                source={origen}
              />
            </section>
          ) : null}

          {/* ------------------------------------------------------ listas */}
          {hayListas ? (
            <section id="listas" className="scroll-mt-28">
              <h2 className="t-section mb-1">Listas de invitados</h2>
              <p className="t-meta mb-4">
                La inscripción no garantiza el ingreso: depende del cupo, del horario y del
                criterio de admisión del local.
              </p>
              <div className="space-y-3">
                {event.guestLists.map((list) => (
                  <GuestListPanel
                    key={list.id}
                    list={list}
                    eventSlug={event.slug}
                    isAuthenticated={Boolean(session)}
                    demoMode={demo}
                    defaultName={session?.user.fullName ?? ""}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <PromotionList promotions={event.venue.promotions} />

          {/* -------------------------------------------------- informacion */}
          <section id="informacion" className="scroll-mt-28 space-y-6">
            <h2 className="t-section">Información</h2>

            {/* Lo esencial NO se pliega: edad, ultimo ingreso, vestimenta y
                devoluciones se deciden antes de pagar. */}
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Dato icon={Users} label="Edad mínima">
                {event.minAge} años · documento de identidad
              </Dato>
              {event.lastEntryAt ? (
                <Dato icon={Clock} label="Último ingreso">
                  {formatTime(event.lastEntryAt)}
                </Dato>
              ) : null}
              {event.venue.dressCode ? (
                <Dato icon={ShieldAlert} label="Vestimenta">
                  {event.venue.dressCode}
                </Dato>
              ) : null}
              {event.doorsOpenAt ? (
                <Dato icon={CalendarDays} label="Apertura de puertas">
                  {formatTime(event.doorsOpenAt)}
                </Dato>
              ) : null}
            </dl>

            {event.description ? (
              <div className="panel">
                <h3 className="font-display text-base font-semibold">Sobre el evento</h3>
                <p className="t-body mt-2 max-w-prose whitespace-pre-line text-white/85">
                  {event.description}
                </p>
              </div>
            ) : null}

            {event.lineup.length > 0 ? (
              <div className="panel">
                <h3 className="font-display text-base font-semibold">Line-up</h3>
                <ul className="mt-3 space-y-3">
                  {event.lineup.map((artist) => (
                    <li key={artist.name} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-3">
                        <Music className="size-4 shrink-0 text-lime" aria-hidden="true" />
                        <span>
                          <span className="block text-base">{artist.name}</span>
                          {artist.role ? (
                            <span className="t-meta text-sm">{artist.role}</span>
                          ) : null}
                        </span>
                      </span>
                      {artist.start ? (
                        <span className="t-meta shrink-0">{artist.start}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Lo largo se pliega, pero empieza abierto lo que condiciona la
                compra: las reglas de ingreso y la politica de cancelacion. */}
            {event.entryRules ? (
              <Disclosure title="Reglas de ingreso" defaultOpen className="panel">
                <p className="t-body whitespace-pre-line text-white/85">{event.entryRules}</p>
                <p className="t-meta mt-3">
                  El ingreso depende del aforo autorizado del local y de su derecho de admisión.
                  Tu entrada pagada es válida, pero GETIN no puede garantizar el acceso si el
                  local alcanza su aforo.
                </p>
              </Disclosure>
            ) : null}

            {event.cancellationPolicy ? (
              <Disclosure title="Cancelación y devoluciones" defaultOpen className="panel">
                <p className="t-body whitespace-pre-line text-white/85">
                  {event.cancellationPolicy}
                </p>
                <Link
                  href="/legal/reembolsos"
                  className="mt-2 inline-block text-sm text-lime hover:underline"
                >
                  Ver política general de reembolsos →
                </Link>
              </Disclosure>
            ) : null}

            <Disclosure title="El local por dentro" className="panel">
              <VenueFacts venue={event.venue} bare />
              <VenueGallery venue={event.venue} bare className="mt-6" />
            </Disclosure>

            {/* Acciones secundarias: aqui no compiten con comprar. */}
            <div className="panel flex flex-wrap items-center gap-x-6 gap-y-3">
              <CalendarButton
                name={event.name}
                venueName={event.venue.name}
                address={`${event.venue.address}, ${event.venue.district}`}
                startsAt={event.startsAt.toISOString()}
                endsAt={event.endsAt ? event.endsAt.toISOString() : null}
              />
              {demo ? null : (
                <CreatePlan
                  eventId={event.id}
                  eventName={event.name}
                  eventSlug={event.slug}
                  isAuthenticated={Boolean(session)}
                  defaultName={session?.user.fullName ?? ""}
                />
              )}
            </div>
          </section>

          {/* ---------------------------------------------------- ubicacion */}
          <section id="ubicacion" className="scroll-mt-28">
            <h2 className="t-section mb-3">Ubicación</h2>
            <p className="text-base">{event.venue.name}</p>
            <p className="t-meta mt-1">
              {event.venue.address}, {event.venue.district}
            </p>
            {event.venue.entranceNotes ? (
              <p className="t-meta mt-2 max-w-prose">{event.venue.entranceNotes}</p>
            ) : null}
            {event.venue.lat !== null && event.venue.lng !== null ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${event.venue.lat},${event.venue.lng}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-lime hover:underline"
              >
                Abrir en Google Maps
                <MapPin className="size-4" aria-hidden="true" />
              </a>
            ) : null}
          </section>
        </div>

        {/* ------------------------------------------------- panel de compra */}
        {/* Solo en escritorio: en movil las entradas ya salen arriba. */}
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
          <TicketSelector
            eventId={event.id}
            eventName={event.name}
            ticketTypes={event.ticketTypes}
            isAuthenticated={Boolean(session)}
            demoMode={demo}
            eventSlug={event.slug}
            minAge={event.minAge}
            dressCode={event.venue.dressCode}
            lastEntryAt={event.lastEntryAt}
            waitingTicketTypes={[...espera.ticketTypes]}
            source={origen}
            hideMobileBar
          />
        </aside>
      </div>
    </article>
  );
}

/** Dato suelto de la ficha: etiqueta pequeña, valor legible. */
function Dato({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden="true" />
      <div>
        <dt className="t-label">{label}</dt>
        <dd className="mt-0.5 text-base">{children}</dd>
      </div>
    </div>
  );
}
