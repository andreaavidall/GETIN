import {
  ArrowRight,
  CreditCard,
  QrCode,
  Search as SearchIcon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { EventCard } from "@/components/catalog/event-card";
import { SearchBar } from "@/components/catalog/search-bar";
import { VenueCard } from "@/components/catalog/venue-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState, EventGridSkeleton } from "@/components/ui/feedback";
import {
  getEventsWithTables,
  getFeaturedEvents,
  getUpcomingEvents,
  getWeekendEvents,
  isDemoMode,
  listVenues,
} from "@/lib/data/catalog";
import { weekendRange } from "@/lib/domain/event-filters";
import {
  formatEventDate,
  formatPEN,
  formatPENShort,
  formatShortDate,
  limaDayNumber,
  limaMonthShort,
} from "@/lib/utils";

export const revalidate = 120;

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=2000&q=70";

export default function HomePage() {
  return (
    <>
      <Hero />

      <div className="container space-y-20 pb-10">
        {isDemoMode() ? <DemoNotice /> : null}

        <Suspense fallback={<SectionSkeleton title="Eventos destacados" />}>
          <FeaturedSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Este fin de semana" />}>
          <WeekendSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Discotecas populares" />}>
          <VenuesSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Mesas VIP disponibles" />}>
          <TablesSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Próximos eventos" />}>
          <UpcomingSection />
        </Suspense>

        <HowItWorks />
        <Faq />
      </div>
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate -mt-16 overflow-hidden pt-16">
      <Image
        src={HERO_IMAGE}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 hero-scrim" />

      <div className="container relative flex min-h-[620px] flex-col justify-end pb-12 pt-20 sm:min-h-[680px]">
        <Badge variant="outline" className="mb-5 w-fit border-lime/40 text-lime">
          <Sparkles className="size-3" />
          Lima · Perú
        </Badge>

        <h1 className="text-display max-w-3xl text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
          La noche empieza aquí.
        </h1>
        <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">
          Descubre los mejores eventos, asegura tu entrada y reserva tu mesa en un solo lugar.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/eventos">
              Explorar eventos
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/discotecas">Ver discotecas</Link>
          </Button>
        </div>

        <div className="mt-10">
          <Suspense fallback={<div className="skeleton h-[76px] w-full rounded-2xl" />}>
            <SearchBar />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = "Ver todo",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-display text-2xl sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-lime transition-opacity hover:opacity-80"
        >
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section>
      <SectionHeader title={title} />
      <EventGridSkeleton count={3} />
    </section>
  );
}

async function FeaturedSection() {
  const events = await getFeaturedEvents(6);
  return (
    <section>
      <SectionHeader
        title="Eventos destacados"
        subtitle="Lo que más se está moviendo esta semana"
        href="/eventos"
      />
      {events.length === 0 ? (
        <EmptyState
          title="Aún no hay eventos publicados"
          description="Cuando una discoteca publique su primer evento aprobado, aparecerá aquí."
          action={
            <Button asChild variant="outline">
              <Link href="/club/registro">Publicar mi local</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => (
            <EventCard key={event.id} event={event} priority={i < 3} />
          ))}
        </div>
      )}
    </section>
  );
}

async function WeekendSection() {
  const events = await getWeekendEvents(6);
  if (events.length === 0) return null;

  // El titulo dice la verdad: de lunes a jueves lo que viene es el fin de
  // semana SIGUIENTE, y hay que nombrarlo así. Y se enseñan las fechas, para
  // que nadie tenga que adivinar de que días hablamos.
  const { from, to, isUpcoming } = weekendRange();

  return (
    <section>
      <SectionHeader
        title={isUpcoming ? "Próximo fin de semana" : "Este fin de semana"}
        subtitle={`Del ${formatShortDate(from)} al ${formatShortDate(to)}`}
        href="/eventos"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

async function VenuesSection() {
  const venues = await listVenues({ limit: 6 });
  if (venues.length === 0) return null;
  return (
    <section>
      <SectionHeader
        title="Discotecas populares"
        subtitle="Locales verificados en Lima"
        href="/discotecas"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {venues.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}
      </div>
    </section>
  );
}

async function TablesSection() {
  const groups = await getEventsWithTables(4);
  if (groups.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title="Mesas VIP disponibles"
        subtitle="Reserva con adelanto y paga el saldo en el local"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map(({ event, tables }) => {
          const cheapest = tables.reduce(
            (min, t) => (t.priceCents < min ? t.priceCents : min),
            tables[0]?.priceCents ?? 0,
          );
          return (
            <Link
              key={event.id}
              href={`/eventos/${event.slug}#mesas`}
              className="surface surface-hover flex items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-lime">
                  {event.venue.name} · {event.venue.district}
                </p>
                <h3 className="mt-1 truncate font-display text-base font-semibold">
                  {event.name}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {formatEventDate(event.startsAt)} · {tables.length}{" "}
                  {tables.length === 1 ? "mesa libre" : "mesas libres"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] uppercase tracking-wide text-muted">Desde</p>
                <p className="font-display text-lg font-bold text-lime">
                  {formatPENShort(cheapest)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

async function UpcomingSection() {
  const events = await getUpcomingEvents(8);
  if (events.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Próximos eventos" subtitle="Agenda de las siguientes semanas" />
      <ul className="surface divide-y divide-white/5">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              href={`/eventos/${event.slug}`}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-white/[0.03]"
            >
              {/* Día y mes SIEMPRE en hora de Lima. Aquí estaba el fallo que
                  hacía que el mismo evento saliera como 27 en una sección y
                  como 28 en otra: el servidor de Vercel corre en UTC. */}
              <div className="w-14 shrink-0 text-center">
                <p className="font-display text-xl font-bold leading-none">
                  {limaDayNumber(event.startsAt)}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                  {limaMonthShort(event.startsAt)}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{event.name}</p>
                <p className="truncate text-xs text-muted">
                  {event.venue.name} · {event.venue.district}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {event.priceFromCents !== null ? (
                  <p className="text-sm font-semibold text-lime">
                    {formatPEN(event.priceFromCents)}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted">{event.availability.label}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  {
    icon: SearchIcon,
    title: "Encuentra el plan",
    text: "Filtra por distrito, fecha, precio o género musical y revisa condiciones antes de decidir.",
  },
  {
    icon: CreditCard,
    title: "Paga seguro",
    text: "El cobro lo procesa una pasarela autorizada. GETIN nunca guarda tu número de tarjeta.",
  },
  {
    icon: QrCode,
    title: "Recibe tu QR",
    text: "Tu entrada aparece en tu cuenta en cuanto el pago queda confirmado por el proveedor.",
  },
  {
    icon: ShieldCheck,
    title: "Entra sin intermediarios",
    text: "En la puerta escanean tu código. Nada de transferencias a personas no verificadas.",
  },
];

function HowItWorks() {
  return (
    <section>
      <SectionHeader title="Cómo funciona GETIN" subtitle="Cuatro pasos, sin promotores" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="surface p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-lime/10">
              <step.icon className="size-5 text-lime" />
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-wide text-muted">Paso {i + 1}</p>
            <h3 className="mt-1 font-display text-base font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-muted">{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "¿Cómo recibo mi entrada?",
    a: "En cuanto el proveedor de pagos confirma la operación, la entrada y su código QR aparecen en «Mis entradas». También te llega un correo. Si el pago queda pendiente, la entrada se emite al confirmarse, no antes.",
  },
  {
    q: "¿Mi QR garantiza el ingreso?",
    a: "Tu entrada pagada es válida para el evento indicado, pero el ingreso siempre depende del aforo autorizado del local y de su derecho de admisión. Las listas de invitados, al no tener costo, estan sujetas a cupo y horario.",
  },
  {
    q: "¿Puedo pedir un reembolso?",
    a: "Depende de la política de cancelación de cada evento, que se muestra antes de pagar y queda registrada en tu compra. Si el evento se cancela, se devuelve el importe completo.",
  },
  {
    q: "¿Qué pasa con mi mesa VIP?",
    a: "Al reservar pagas un adelanto y el saldo se abona en el local. Veras el total, el adelanto, el saldo pendiente y el consumo mínimo antes de confirmar. Una mesa reservada no se vende a nadie mas.",
  },
  {
    q: "¿GETIN cobra comisión?",
    a: "Si. Al precio del local se suma un cargo por servicio que se muestra desglosado en el checkout antes de pagar.",
  },
  {
    q: "Soy dueño de una discoteca, ¿cómo publico?",
    a: "Puedes registrar tu local desde «Publicar mi local». El equipo de GETIN verifica la información comercial antes de que aparezca en el catálogo.",
  },
];

function Faq() {
  return (
    <section>
      <SectionHeader title="Preguntas frecuentes" />
      <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-surface">
        {FAQS.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 text-sm font-medium marker:content-none">
              {item.q}
              <span className="shrink-0 text-lime transition-transform group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="px-5 pb-5 text-sm text-muted">{item.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        ¿Te falta algo?{" "}
        <Link href="/ayuda" className="text-lime hover:underline">
          Centro de ayuda
        </Link>{" "}
        ·{" "}
        <Link href="/contacto" className="text-lime hover:underline">
          Contacto
        </Link>
      </p>
    </section>
  );
}
