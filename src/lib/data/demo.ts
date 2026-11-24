import { availabilityLabel, priceFromCents } from "@/lib/domain/availability";
import type {
  EventDetail,
  EventSummary,
  GuestListView,
  TableView,
  TicketTypeView,
  VenueDetail,
} from "@/types/catalog";

/**
 * CATALOGO DE DEMOSTRACION — TODO FICTICIO.
 *
 * Existe para que `npm run dev` funcione sin Supabase y para poder enseñar la
 * plataforma. Los mismos datos estan en `supabase/seed.sql`, de modo que la
 * versión con base de datos se vea igual.
 *
 * Cada local y evento lleva `isDemo: true`, y la interfaz pinta el aviso "DEMO"
 * en cada tarjeta: ningún evento de aquí se presenta como real ni se puede
 * comprar (el checkout exige Supabase).
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * Las horas de una discoteca son horas de LIMA.
 *
 * Si se construyen con `setHours()` quedan en la zona del servidor y la
 * interfaz, que formatea en America/Lima, las muestra desplazadas (una fiesta
 * "a las 6 p. m."). Perú no aplica horario de verano: siempre UTC-5, así que se
 * puede fijar el desfase directamente.
 */
const LIMA_OFFSET = "-05:00";

function limaDate(daysFromNow: number, hhmm: string): Date {
  const base = new Date(Date.now() + daysFromNow * DAY);
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
  return new Date(`${ymd}T${hhmm}:00${LIMA_OFFSET}`);
}

function at(daysFromNow: number, hour: number, minute = 0): Date {
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return limaDate(daysFromNow, hhmm);
}

/** Día de la semana actual en Lima (0 = domingo). */
function limaDayOfWeek(): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    weekday: "short",
  }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** Próximo sábado a las 23:00 (hora de Lima). */
function nextSaturday(hour = 23): Date {
  const delta = (6 - limaDayOfWeek() + 7) % 7 || 7;
  return at(delta, hour);
}

function nextFriday(hour = 19): Date {
  const delta = (5 - limaDayOfWeek() + 7) % 7 || 7;
  return at(delta, hour);
}

/**
 * Horas relativas al INICIO de cada evento.
 *
 * Todas las fechas de un evento (cierre, puertas, último ingreso, ventanas de
 * venta, cierre de listas) se derivan de su `startsAt`. Antes cada una era un
 * desfase independiente desde "hoy", y eso producia incoherencias visibles: la
 * preventa del sábado cerraba "dentro de 4 días" mientras el evento era "el
 * próximo sábado", que según el día podia estar a uno o dos. Es decir, la venta
 * cerraba después de la fiesta.
 */
function before(start: Date, hours: number): Date {
  return new Date(start.getTime() - hours * HOUR);
}

function after(start: Date, hours: number): Date {
  return new Date(start.getTime() + hours * HOUR);
}

// Inicio de cada evento del catalogo de demostracion. Se calcula una sola vez
// y de el cuelga todo lo demas.
const START_SATURDAY = nextSaturday(23);
const START_FRIDAY = nextFriday(19);
const START_LATIN = at(10, 22);
const START_TECHNO = at(17, 23, 30);
const START_ANNIVERSARY = at(31, 23);

const ticket = (
  id: string,
  name: string,
  priceCents: number,
  capacity: number,
  soldCount: number,
  extra: Partial<TicketTypeView> = {},
): TicketTypeView => ({
  id,
  name,
  priceCents,
  capacity,
  soldCount,
  heldCount: 0,
  includes: [],
  maxPerOrder: 6,
  salesStartAt: new Date(Date.now() - 10 * DAY),
  salesEndAt: null,
  isActive: true,
  description: null,
  conditions: null,
  ...extra,
});

const table = (
  id: string,
  label: string,
  zone: string,
  capacity: number,
  priceCents: number,
  depositCents: number,
  minConsumptionCents: number,
  state: TableView["state"] = "available",
  conditions: string | null = null,
  position: [number, number] | null = null,
  includesEntryFor: number | null = null,
): TableView => ({
  id,
  venueTableId: `vt-${id}`,
  label,
  zone,
  capacity,
  priceCents,
  depositCents,
  minConsumptionCents,
  state,
  heldUntil: null,
  conditions,
  positionX: position?.[0] ?? null,
  positionY: position?.[1] ?? null,
  includesEntryFor,
});

// ------------------------------------------------------------------ locales ---
export const DEMO_VENUES: VenueDetail[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    slug: "nocturna-barranco",
    name: "Nocturna Barranco",
    district: "Barranco",
    address: "Av. Grau 234, Barranco",
    city: "Lima",
    description:
      "Casona republicana convertida en club de tres ambientes: pista principal, patio y sótano de techno.",
    coverUrl:
      "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=1600&q=70",
    musicGenres: ["House", "Techno", "Reggaeton"],
    isVerified: true,
    isDemo: true,
    upcomingEvents: 2,
    lat: -12.1485,
    lng: -77.0219,
    phone: "+51 999 000 001",
    instagram: "@nocturna.demo",
    capacity: 850,
    minAge: 20,
    dressCode: "Casual elegante. No shorts ni sandalias.",
    ambiences: ["Pista principal", "Patio al aire libre", "Sótano", "Zona para sentarse"],
    accessibility: "Rampa en el ingreso principal. El sótano solo tiene escalera.",
    parking: "Sin estacionamiento propio. Playas de pago en la cuadra 2 de Grau.",
    entranceNotes: "El ingreso es por Av. Grau. La cola de lista va por la puerta lateral.",
    photos: [],
    promotions: [],
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    slug: "vertigo-miraflores",
    name: "Vértigo Miraflores",
    district: "Miraflores",
    address: "Calle Berlín 921, Miraflores",
    city: "Lima",
    description:
      "Rooftop con vista al malecón, coctelería de autor y sesiones de house hasta el amanecer.",
    coverUrl:
      "https://images.unsplash.com/photo-1545128485-c400e7702796?w=1600&q=70",
    musicGenres: ["House", "Deep House", "Disco"],
    isVerified: true,
    isDemo: true,
    upcomingEvents: 1,
    lat: -12.1248,
    lng: -77.0301,
    phone: "+51 999 000 002",
    instagram: "@vertigo.demo",
    capacity: 420,
    minAge: 21,
    dressCode: "Elegante. Prohibido el ingreso con mochilas.",
    ambiences: ["Terraza", "Pista", "Barra lounge"],
    accessibility: "Ascensor hasta la terraza. Baño adaptado en el piso 2.",
    parking: "Estacionamiento del edificio, S/ 10 la noche.",
    entranceNotes: "Ingreso por el lobby del edificio, piso 11.",
    photos: [],
    promotions: [],
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    slug: "club-fauna",
    name: "Club Fauna",
    district: "San Isidro",
    address: "Av. Conquistadores 455, San Isidro",
    city: "Lima",
    description:
      "Club de música latina y urbana en pleno San Isidro, con tres barras y zona VIP elevada.",
    coverUrl:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&q=70",
    musicGenres: ["Reggaeton", "Salsa", "Urbano"],
    isVerified: true,
    isDemo: true,
    upcomingEvents: 1,
    lat: -12.0974,
    lng: -77.0382,
    phone: "+51 999 000 003",
    instagram: "@fauna.demo",
    capacity: 600,
    minAge: 18,
    dressCode: "Casual.",
    ambiences: ["Pista", "Zona para sentarse", "Terraza techada"],
    accessibility: "Rampa y baño adaptado.",
    parking: "Estacionamiento propio para 40 autos, incluido con mesa.",
    entranceNotes: "Ingreso por la puerta principal; las mesas entran por recepción.",
    photos: [],
    promotions: [],
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    slug: "subsuelo-lima",
    name: "Subsuelo",
    district: "Surquillo",
    address: "Av. Tomás Marsano 110, Surquillo",
    city: "Lima",
    description:
      "Sótano de 300 personas dedicado al techno y al drum and bass. Sonido Funktion-One.",
    coverUrl:
      "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=1600&q=70",
    musicGenres: ["Techno", "Drum & Bass"],
    isVerified: false,
    isDemo: true,
    upcomingEvents: 1,
    lat: -12.1139,
    lng: -77.0125,
    phone: "+51 999 000 004",
    instagram: "@subsuelo.demo",
    capacity: 300,
    minAge: 18,
    dressCode: "Libre.",
    ambiences: ["Pista", "Sala de escucha"],
    accessibility: "Local en un solo nivel, sin escalones.",
    parking: "En la calle. La zona es tranquila pero conviene llegar temprano.",
    entranceNotes: "Puerta negra sin letrero, al costado del taller mecánico.",
    photos: [],
    promotions: [],
  },
];

// ------------------------------------------------------------------ eventos ---
type DemoEventSeed = Omit<
  EventDetail,
  "priceFromCents" | "availability" | "hasTables" | "hasGuestList" | "venue"
> & { venueSlug: string };

const SEEDS: DemoEventSeed[] = [
  {
    id: "b0000000-0000-4000-8000-000000000001",
    slug: "nocturna-saturday-house",
    name: "Saturday House",
    tagline: "La fiesta de casa de Nocturna, cada sábado",
    description:
      "Tres ambientes, dos pistas y la terraza abierta hasta el cierre. House melódico en la pista principal y selección urbana en el patio.",
    coverUrl:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1600&q=70",
    startsAt: START_SATURDAY,
    endsAt: after(START_SATURDAY, 7),
    doorsOpenAt: before(START_SATURDAY, 1),
    lastEntryAt: after(START_SATURDAY, 4),
    minAge: 20,
    musicGenres: ["House", "Reggaeton"],
    isDemo: true,
    venueSlug: "nocturna-barranco",
    entryRules:
      "Documento de identidad obligatorio. Reservamos el derecho de admisión según el aforo autorizado.",
    cancellationPolicy:
      "Cancelación con reembolso completo hasta 48 horas antes del evento. Después de ese plazo no hay devolución.",
    lineup: [
      { name: "DJ Mara", role: "Headliner", start: "01:00" },
      { name: "Bruno Sas", role: "Opening", start: "23:00" },
    ],
    ticketTypes: [
      ticket("t1-preventa", "Preventa", 4500, 150, 118, {
        description: "Cupo limitado, primera tanda.",
        conditions: "Válida solo hasta las 00:30. No incluye consumo.",
        maxPerOrder: 4,
        // Cierra tres horas antes de que abran las puertas, nunca después.
        salesEndAt: before(START_SATURDAY, 3),
      }),
      ticket("t1-general", "General", 7000, 400, 96, {
        description: "Ingreso a los tres ambientes.",
        conditions: "No incluye consumo.",
      }),
      ticket("t1-vip", "VIP", 15000, 60, 12, {
        description: "Zona elevada y barra exclusiva.",
        conditions: "Incluye un trago de bienvenida. No garantiza asiento.",
        maxPerOrder: 4,
      }),
    ],
    tables: [
      table(
        "tb1",
        "Mesa 1",
        "Zona VIP",
        6,
        60000,
        20000,
        40000,
        "available",
        "El adelanto no es reembolsable. El consumo mínimo se abona en el local.",
      ),
      table("tb2", "Mesa 2", "Zona VIP", 6, 60000, 20000, 40000, "reserved"),
      table(
        "tb3",
        "Box A",
        "Balcón",
        10,
        120000,
        40000,
        90000,
        "available",
        "Ingreso preferente hasta la 01:00. El adelanto no es reembolsable.",
      ),
    ],
    guestLists: [
      {
        id: "gl1",
        name: "Lista Nocturna · ingreso 23:00-00:30",
        description: "Inscríbete y entra sin costo antes de las 00:30.",
        capacity: 120,
        confirmedCount: 64,
        signupDeadline: before(START_SATURDAY, 3),
        lastEntryAt: after(START_SATURDAY, 1.5),
        conditions:
          "El ingreso depende del aforo autorizado del local y del criterio de admisión. La inscripción no garantiza el acceso.",
        benefits: "Sin costo de entrada antes de las 00:30.",
        autoApprove: true,
        isOpen: true,
      },
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    slug: "vertigo-sunset-rooftop",
    name: "Sunset Rooftop",
    tagline: "Atardecer con vista al malecón",
    description:
      "Sesión de deep house desde las 7 p.m. con la puesta de sol de Miraflores de fondo. Coctelería de autor y cena ligera disponible.",
    coverUrl:
      "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=1600&q=70",
    startsAt: START_FRIDAY,
    endsAt: after(START_FRIDAY, 7),
    doorsOpenAt: before(START_FRIDAY, 0.5),
    lastEntryAt: after(START_FRIDAY, 5),
    minAge: 21,
    musicGenres: ["Deep House", "Disco"],
    isDemo: true,
    venueSlug: "vertigo-miraflores",
    entryRules: "Aforo limitado. Ingreso solo con entrada o reserva confirmada.",
    cancellationPolicy: "Reembolso del 50% hasta 24 horas antes. Las mesas no son reembolsables.",
    lineup: [{ name: "Lucia Vela", role: "Live set", start: "20:00" }],
    ticketTypes: [
      ticket("t2-early", "Early Bird", 3500, 80, 80, {
        description: "Ingreso antes de las 20:00.",
        conditions: "Agotada. Ingreso hasta las 20:00.",
        maxPerOrder: 2,
      }),
      ticket("t2-general", "General", 6000, 200, 54, {
        description: "Ingreso general al rooftop.",
        conditions: "Aforo limitado.",
      }),
    ],
    tables: [
      table("tb4", "Lounge 1", "Terraza", 8, 90000, 30000, 70000, "available", "Incluye servicio de mozo."),
      table("tb5", "Lounge 2", "Terraza", 8, 90000, 30000, 70000, "blocked"),
    ],
    guestLists: [],
  },
  {
    id: "b0000000-0000-4000-8000-000000000003",
    slug: "fauna-noche-latina",
    name: "Noche Latina",
    tagline: "Salsa, timba y urbano hasta el cierre",
    description:
      "Orquesta en vivo a medianoche y DJ urbano después. La noche más concurrida de San Isidro.",
    coverUrl:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1600&q=70",
    startsAt: START_LATIN,
    endsAt: after(START_LATIN, 7),
    doorsOpenAt: before(START_LATIN, 1),
    lastEntryAt: after(START_LATIN, 4),
    minAge: 18,
    musicGenres: ["Salsa", "Reggaeton", "Urbano"],
    isDemo: true,
    venueSlug: "club-fauna",
    entryRules: "Mayores de 18 con DNI o carné de extranjería.",
    cancellationPolicy: "Reembolso completo hasta 72 horas antes.",
    lineup: [
      { name: "Orquesta Fauna", role: "En vivo", start: "00:00" },
      { name: "DJ Keko", role: "Cierre", start: "01:30" },
    ],
    ticketTypes: [
      ticket("t3-general", "General", 3000, 350, 140, {
        description: "Ingreso general.",
        conditions: "No incluye consumo.",
        maxPerOrder: 8,
      }),
      ticket("t3-pareja", "Preventa pareja", 5000, 100, 31, {
        description: "Dos ingresos.",
        conditions: "Equivale a dos personas. Ingreso conjunto.",
        maxPerOrder: 2,
        salesEndAt: before(START_LATIN, 24),
      }),
    ],
    tables: [table("tb6", "Mesa 10", "Pista", 4, 45000, 15000, 30000, "available", "Hasta 4 personas.")],
    guestLists: [
      {
        id: "gl2",
        name: "Lista Fauna",
        description: "Lista de cortesía con aprobación del local.",
        capacity: 80,
        confirmedCount: 22,
        signupDeadline: before(START_LATIN, 24),
        lastEntryAt: after(START_LATIN, 1.5),
        conditions: "Sujeta a aprobación y al aforo del local. No garantiza el ingreso.",
        benefits: "Ingreso sin costo antes de las 23:30.",
        autoApprove: false,
        isOpen: true,
      },
    ],
  },
  {
    id: "b0000000-0000-4000-8000-000000000004",
    slug: "subsuelo-techno-session",
    name: "Techno Session 014",
    tagline: "Seis horas de techno continuo",
    description:
      "Sótano, luces mínimas y sonido Funktion-One. Entrada por aforo estricto de 300 personas.",
    coverUrl:
      "https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=1600&q=70",
    startsAt: START_TECHNO,
    endsAt: after(START_TECHNO, 6.5),
    doorsOpenAt: before(START_TECHNO, 0.5),
    lastEntryAt: after(START_TECHNO, 2.5),
    minAge: 18,
    musicGenres: ["Techno"],
    isDemo: true,
    venueSlug: "subsuelo-lima",
    entryRules: "Sin reingreso. Guardarropa obligatorio para mochilas.",
    cancellationPolicy: "Entradas no reembolsables salvo cancelación del evento.",
    lineup: [{ name: "Nerea K", role: "Headliner", start: "02:00" }],
    ticketTypes: [
      ticket("t4-pre1", "Preventa 1", 5000, 100, 100, {
        description: "Primera tanda.",
        conditions: "Agotada.",
        maxPerOrder: 4,
        salesEndAt: new Date(Date.now() - 2 * DAY),
      }),
      ticket("t4-pre2", "Preventa 2", 6500, 120, 44, {
        description: "Segunda tanda.",
        conditions: "Sin reingreso.",
        maxPerOrder: 4,
        salesStartAt: new Date(Date.now() - 2 * DAY),
      }),
    ],
    tables: [],
    guestLists: [],
  },
  {
    id: "b0000000-0000-4000-8000-000000000005",
    slug: "nocturna-aniversario",
    name: "Aniversario Nocturna · 7 años",
    tagline: "Line-up completo y capacidad ampliada",
    description:
      "Edición aniversario con los tres ambientes conectados y invitados internacionales.",
    coverUrl:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&q=70",
    startsAt: START_ANNIVERSARY,
    endsAt: after(START_ANNIVERSARY, 8),
    doorsOpenAt: before(START_ANNIVERSARY, 1),
    lastEntryAt: after(START_ANNIVERSARY, 4),
    minAge: 20,
    musicGenres: ["House", "Techno"],
    isDemo: true,
    venueSlug: "nocturna-barranco",
    entryRules: "Documento obligatorio.",
    cancellationPolicy: "Reembolso completo hasta 7 días antes.",
    lineup: [{ name: "Invitado internacional", role: "Headliner", start: "02:00" }],
    ticketTypes: [
      ticket("t5-early", "Early Bird", 8000, 200, 23, {
        description: "Precio de lanzamiento.",
        conditions: "Cupo limitado.",
        maxPerOrder: 4,
        salesEndAt: before(START_ANNIVERSARY, 24 * 17),
      }),
      ticket("t5-general", "General", 12000, 500, 0, {
        description: "Ingreso general.",
        conditions: "No incluye consumo.",
        salesStartAt: before(START_ANNIVERSARY, 24 * 17),
      }),
    ],
    tables: [],
    guestLists: [],
  },
];

function venueBySlug(slug: string): VenueDetail {
  const found = DEMO_VENUES.find((v) => v.slug === slug);
  if (!found) throw new Error(`Local demo no encontrado: ${slug}`);
  return found;
}

function hydrate(seed: DemoEventSeed, now: Date): EventDetail {
  const venue = venueBySlug(seed.venueSlug);
  const { venueSlug: _unused, ...rest } = seed;
  return {
    ...rest,
    venue,
    priceFromCents: priceFromCents(seed.ticketTypes, now),
    availability: availabilityLabel(seed.ticketTypes, now),
    hasTables: seed.tables.some((t) => t.state === "available"),
    hasGuestList: seed.guestLists.some((g) => g.isOpen),
  };
}

export function demoEvents(now: Date = new Date()): EventDetail[] {
  return SEEDS.map((seed) => hydrate(seed, now)).sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}

export function demoEventSummaries(now: Date = new Date()): EventSummary[] {
  return demoEvents(now);
}

export function demoEventBySlug(slug: string, now: Date = new Date()): EventDetail | null {
  return demoEvents(now).find((e) => e.slug === slug) ?? null;
}

export function demoVenues(now: Date = new Date()): VenueDetail[] {
  const events = demoEvents(now);
  return DEMO_VENUES.map((v) => ({
    ...v,
    upcomingEvents: events.filter((e) => e.venue.slug === v.slug && e.startsAt > now).length,
  }));
}

export function demoVenueBySlug(slug: string, now: Date = new Date()): VenueDetail | null {
  return demoVenues(now).find((v) => v.slug === slug) ?? null;
}

export type { GuestListView };
