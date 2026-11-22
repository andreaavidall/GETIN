import type {
  TableAvailabilitySnapshot,
  TicketTypeSnapshot,
} from "@/lib/domain/availability";

/** Modelos de vista del catalogo. Es lo único que consumen las páginas. */

export type VenueSummary = {
  id: string;
  slug: string;
  name: string;
  district: string;
  coverUrl: string | null;
  musicGenres: string[];
  isVerified: boolean;
  isDemo: boolean;
  upcomingEvents: number;
};

export type VenueDetail = VenueSummary & {
  description: string | null;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  instagram: string | null;
  capacity: number | null;
  minAge: number;
  dressCode: string | null;
};

export type LineupEntry = { name: string; role?: string; start?: string };

export type TicketTypeView = TicketTypeSnapshot & {
  description: string | null;
  conditions: string | null;
};

export type TableView = TableAvailabilitySnapshot & {
  label: string;
  zone: string | null;
  capacity: number;
  conditions: string | null;
};

export type GuestListView = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  confirmedCount: number;
  signupDeadline: Date | null;
  lastEntryAt: Date | null;
  conditions: string | null;
  benefits: string | null;
  autoApprove: boolean;
  isOpen: boolean;
};

export type EventSummary = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  coverUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  minAge: number;
  musicGenres: string[];
  isDemo: boolean;
  venue: { id: string; slug: string; name: string; district: string; isVerified: boolean };
  priceFromCents: number | null;
  availability: { tone: "available" | "low" | "soldout" | "closed"; label: string };
  hasTables: boolean;
  hasGuestList: boolean;
};

export type EventDetail = EventSummary & {
  description: string | null;
  doorsOpenAt: Date | null;
  lastEntryAt: Date | null;
  entryRules: string | null;
  cancellationPolicy: string | null;
  lineup: LineupEntry[];
  venue: VenueDetail;
  ticketTypes: TicketTypeView[];
  tables: TableView[];
  guestLists: GuestListView[];
};

export type EventFilters = {
  q?: string;
  district?: string;
  genre?: string;
  venueSlug?: string;
  /** ISO date (YYYY-MM-DD) */
  dateFrom?: string;
  dateTo?: string;
  /** Precio máximo en centimos. */
  maxPriceCents?: number;
  sort?: "date_asc" | "date_desc" | "price_asc" | "price_desc";
  limit?: number;
};

export const LIMA_DISTRICTS = [
  "Barranco",
  "Miraflores",
  "San Isidro",
  "Surquillo",
  "Surco",
  "Chorrillos",
  "Lince",
  "Magdalena",
  "San Borja",
  "Centro de Lima",
] as const;

export const MUSIC_GENRES = [
  "House",
  "Deep House",
  "Techno",
  "Reggaeton",
  "Urbano",
  "Salsa",
  "Disco",
  "Drum & Bass",
  "Pop",
] as const;
