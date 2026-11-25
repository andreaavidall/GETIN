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
import { EventCarousel } from "@/components/catalog/event-carousel";
import { CoverImage } from "@/components/ui/cover-image";
import { SearchBar } from "@/components/catalog/search-bar";
import { VenueCard } from "@/components/catalog/venue-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState, EventGridSkeleton } from "@/components/ui/feedback";
import {
  getEventsWithTables,
  getFeaturedEvents,
  getWeekendEvents,
  isDemoMode,
  listVenues,
} from "@/lib/data/catalog";
import { weekendRange } from "@/lib/domain/event-filters";
import {
  formatEventDate,
  formatPENShort,
  formatShortDate,
} from "@/lib/utils";

export const revalidate = 120;

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=2000&q=70";

/**
 * Portada.
 *
 * Orden deliberado: primero lo que se busca (hero y buscador), despues lo que
 * hay esta noche y este fin de semana, luego mesas, locales y por ultimo las
 * explicaciones. Las secciones ya no repiten los mismos eventos: la agenda
 * general desaparecio de aqui —estaba enseñando por tercera vez lo mismo— y
 * se llega a ella por "Ver todo".
 */
export default function HomePage() {
  return (
    <>
      <Hero />

      <div className="container space-y-14 pb-12 sm:space-y-16">
        {isDemoMode() ? <DemoNotice /> : null}

        <Suspense fallback={<SectionSkeleton title="Esta semana en Lima" />}>
          <FeaturedSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Planes del fin de semana" />}>
          <WeekendSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Mesas VIP" />}>
          <TablesSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title="Discotecas" />}>
          <VenuesSection />
        </Suspense>

        <HowItWorks />
        <Faq />
      </div>
    </>
  );
}

/**
 * Hero.
 *
 * Antes medía 620 px de alto y, con el formulario completo debajo, ocupaba la
 * primera pantalla del móvil entera: no se veía ni un evento sin desplazar.
 * Ahora cabe en poco más de la mitad y los destacados asoman desde el primer
 * momento, que es de lo que vive un catálogo.
 *
 * Una sola acción en lima —Explorar eventos—. «Ver discotecas» baja a enlace
 * secundario: dos botones del mismo peso no son una decisión, son un empate.
 */
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

      <div className="container relative flex flex-col justify-end pb-8 pt-10 sm:pt-16">
        <Badge variant="outline" className="mb-4 w-fit border-lime/40 text-lime">
          <Sparkles className="size-3" />
          Lima · Perú
        </Badge>

        <h1 className="t-hero max-w-3xl">Tu próxima noche empieza aquí.</h1>
        <p className="mt-3 max-w-lg text-base text-white/75">
          Entradas, mesas y listas de las discotecas de Lima.
        </p>

        <div className="mt-6">
          <Suspense fallback={<div className="skeleton h-[108px] w-full rounded-2xl" />}>
            <SearchBar />
          </Suspense>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button asChild size="lg">
            <Link href="/eventos">
              Explorar eventos
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Link
            href="/discotecas"
            className="text-sm font-medium text-muted underline-offset-4 transition-colors duration-200 hover:text-paper hover:underline"
          >
            Ver discotecas
          </Link>
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
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="t-section">{title}</h2>
        {subtitle ? <p className="t-meta mt-1">{subtitle}</p> : null}
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

/**
 * Destacados: TRES, no seis.
 *
 * Con seis, la portada enseñaba casi el catalogo entero antes de que nadie
 * pidiera nada, y las mismas fiestas volvian a salir dos secciones mas abajo.
 * Tres caben en una fila completa en escritorio —sin huecos— y en movil son
 * un carrusel donde asoma la siguiente.
 */
async function FeaturedSection() {
  const events = await getFeaturedEvents(3);
  return (
    <section className="fade-rise">
      <SectionHeader
        title="Esta semana en Lima"
        subtitle="Lo que más se está moviendo"
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
        <EventCarousel label="Eventos destacados">
          {events.map((event, i) => (
            <EventCard key={event.id} event={event} priority={i < 3} />
          ))}
        </EventCarousel>
      )}
    </section>
  );
}

/**
 * Fin de semana, SIN repetir lo que ya salio en destacados: ver la misma
 * fiesta tres veces en una pantalla no es un catalogo, es un eco.
 */
async function WeekendSection() {
  const [weekend, featured] = await Promise.all([getWeekendEvents(6), getFeaturedEvents(3)]);
  const yaVistos = new Set(featured.map((e) => e.id));
  const events = weekend.filter((e) => !yaVistos.has(e.id)).slice(0, 3);
  if (events.length === 0) return null;

  // El titulo dice la verdad: de lunes a jueves lo que viene es el fin de
  // semana SIGUIENTE, y hay que nombrarlo así. Y se enseñan las fechas, para
  // que nadie tenga que adivinar de que días hablamos.
  const { from, to, isUpcoming } = weekendRange();
  // `to` es el lunes a las 06:00: el cierre de la madrugada del domingo, no un
  // dia mas de fiesta. Enseñar "al 30 nov" hacia creer que el lunes entraba.
  const ultimoDia = new Date(to.getTime() - 12 * 3_600_000);

  return (
    <section>
      <SectionHeader
        title={isUpcoming ? "Planes del próximo finde" : "Planes de este finde"}
        subtitle={`Del ${formatShortDate(from)} al ${formatShortDate(ultimoDia)}`}
        href="/eventos"
      />
      <EventCarousel label="Planes del fin de semana">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </EventCarousel>
    </section>
  );
}

async function VenuesSection() {
  const venues = await listVenues({ limit: 6 });
  if (venues.length === 0) return null;

  // Decir "verificados" encima de locales de demostracion es exactamente lo
  // que no se puede hacer. El subtitulo cuenta lo que hay.
  const verificados = venues.filter((v) => v.isVerified && !v.isDemo).length;
  const subtitle =
    verificados === venues.length
      ? "Locales verificados en Lima"
      : verificados > 0
        ? `${verificados} de ${venues.length} verificados por GETIN`
        : "Catálogo de demostración: ninguno está verificado todavía";

  return (
    <section>
      <SectionHeader title="Discotecas populares" subtitle={subtitle} href="/discotecas" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {venues.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}
      </div>
    </section>
  );
}

/**
 * Mesas VIP con presentacion propia.
 *
 * Antes era una fila de texto igual que las demas secciones. Una mesa se
 * vende por el sitio, asi que ahora lleva la foto del evento, lo que se paga
 * ahora y lo que queda para el local: las dos cifras que se preguntan.
 */
async function TablesSection() {
  const groups = await getEventsWithTables(3);
  if (groups.length === 0) return null;

  return (
    <section className="fade-rise">
      <SectionHeader
        title="Mesas VIP"
        subtitle="Reservas con adelanto; el saldo se paga en el local"
        href="/eventos?experiencia=mesas"
        linkLabel="Ver todas"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(({ event, tables }) => {
          const masBarata = tables.reduce(
            (min, t) => (t.depositCents < min ? t.depositCents : min),
            tables[0]?.depositCents ?? 0,
          );
          const libres = tables.length;

          return (
            <Link
              key={event.id}
              href={`/eventos/${event.slug}#mesas`}
              className="group relative overflow-hidden rounded-[var(--radius-card)] border border-white/10 transition-colors duration-200 hover:border-lime/40"
            >
              <div className="relative aspect-[16/11]">
                <CoverImage
                  src={event.coverUrl}
                  alt=""
                  name={event.name}
                  sizes="(max-width: 640px) 90vw, 33vw"
                />

                <div className="absolute inset-x-4 bottom-4">
                  <p className="t-label text-lime">
                    {libres} {libres === 1 ? "mesa libre" : "mesas libres"}
                  </p>
                  <h3 className="t-card mt-1 line-clamp-1">{event.name}</h3>
                  <p className="mt-0.5 text-sm text-white/80">
                    {event.venue.name} · {formatEventDate(event.startsAt, { withTime: false })}
                  </p>
                </div>
              </div>

              <div className="flex items-end justify-between gap-3 bg-surface p-4">
                <div>
                  <span className="t-label block">Adelanto desde</span>
                  <span className="t-price">{formatPENShort(masBarata)}</span>
                </div>
                <span className="text-sm font-medium text-lime transition-transform duration-200 group-hover:translate-x-0.5">
                  Ver mesas →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
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
