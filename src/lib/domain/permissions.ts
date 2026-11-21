/**
 * Control de acceso basado en roles.
 *
 * Modulo puro: decide a partir de un "actor" (rol global + locales a los que
 * pertenece) si una accion esta permitida. Lo usan los guards del servidor
 * (`src/lib/auth/guards.ts`) y lo cubren los tests.
 *
 * Ocultar un boton no es seguridad: toda ruta y accion vuelve a preguntar aqui,
 * y la base de datos lo verifica otra vez por RLS.
 */

export type AppRole = "client" | "club_admin" | "door_staff" | "superadmin";
export type VenueRole = "owner" | "manager" | "door";

export type VenueMembership = {
  venueId: string;
  role: VenueRole;
  isActive: boolean;
};

export type Actor = {
  userId: string;
  role: AppRole;
  isSuspended: boolean;
  memberships: VenueMembership[];
};

export const ANON: Actor | null = null;

export type Action =
  // catalogo
  | "catalog.read"
  // cliente
  | "order.create"
  | "order.readOwn"
  | "ticket.readOwn"
  | "guestList.join"
  | "refund.request"
  // local
  | "venue.readDashboard"
  | "venue.manageEvents"
  | "venue.manageTickets"
  | "venue.manageTables"
  | "venue.manageGuestLists"
  | "venue.manageStaff"
  | "venue.readAttendees"
  | "venue.readPayments"
  | "venue.exportReports"
  // puerta
  | "door.scan"
  // GETIN
  | "admin.approveVenues"
  | "admin.manageUsers"
  | "admin.readTransactions"
  | "admin.configureCommissions"
  | "admin.decideRefunds"
  | "admin.readAudit";

/** Acciones de local que requieren mandar en el establecimiento. */
const VENUE_MANAGE_ACTIONS: Action[] = [
  "venue.manageEvents",
  "venue.manageTickets",
  "venue.manageTables",
  "venue.manageGuestLists",
  "venue.manageStaff",
  "venue.readPayments",
  "venue.exportReports",
];

const ADMIN_ACTIONS: Action[] = [
  "admin.approveVenues",
  "admin.manageUsers",
  "admin.readTransactions",
  "admin.configureCommissions",
  "admin.decideRefunds",
  "admin.readAudit",
];

export function membershipFor(actor: Actor, venueId: string): VenueMembership | null {
  return actor.memberships.find((m) => m.venueId === venueId && m.isActive) ?? null;
}

export function isSuperadmin(actor: Actor | null): boolean {
  return actor?.role === "superadmin" && !actor.isSuspended;
}

/**
 * ¿Puede `actor` ejecutar `action`? Si la accion es de un local concreto hay que
 * pasar `venueId`: sin el, se deniega (evita el fallo de "permitido en algun local").
 */
export function can(actor: Actor | null, action: Action, venueId?: string): boolean {
  if (action === "catalog.read") return true;
  if (!actor || actor.isSuspended) return false;

  if (ADMIN_ACTIONS.includes(action)) {
    return isSuperadmin(actor);
  }
  if (isSuperadmin(actor)) return true;

  switch (action) {
    case "order.create":
    case "order.readOwn":
    case "ticket.readOwn":
    case "guestList.join":
    case "refund.request":
      // Cualquier cuenta activa compra como cliente, incluido el personal.
      return true;

    case "door.scan": {
      if (!venueId) return false;
      const m = membershipFor(actor, venueId);
      return m !== null; // owner, manager y door pueden escanear
    }

    case "venue.readDashboard":
    case "venue.readAttendees": {
      if (!venueId) return false;
      return membershipFor(actor, venueId) !== null;
    }

    default: {
      if (VENUE_MANAGE_ACTIONS.includes(action)) {
        if (!venueId) return false;
        const m = membershipFor(actor, venueId);
        if (!m) return false;
        if (action === "venue.manageStaff") return m.role === "owner";
        return m.role === "owner" || m.role === "manager";
      }
      return false;
    }
  }
}

/** Locales sobre los que el actor puede abrir el panel. */
export function accessibleVenueIds(actor: Actor | null): string[] {
  if (!actor || actor.isSuspended) return [];
  return actor.memberships.filter((m) => m.isActive).map((m) => m.venueId);
}

/** Ruta inicial segun el rol, para redirigir despues del login. */
export function defaultLandingPath(actor: Actor | null): string {
  if (!actor) return "/";
  if (actor.role === "superadmin") return "/admin";
  const memberships = actor.memberships.filter((m) => m.isActive);
  if (memberships.some((m) => m.role === "owner" || m.role === "manager")) return "/club/dashboard";
  if (memberships.some((m) => m.role === "door")) return "/puerta";
  return "/cuenta";
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(action: Action, venueId?: string) {
    super(`No autorizado para ${action}${venueId ? ` en el local ${venueId}` : ""}`);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor() {
    super("Necesitas iniciar sesion");
    this.name = "UnauthenticatedError";
  }
}

/** Version que lanza: el camino normal en el servidor. */
export function assertCan(actor: Actor | null, action: Action, venueId?: string): void {
  if (action !== "catalog.read" && !actor) throw new UnauthenticatedError();
  if (!can(actor, action, venueId)) throw new ForbiddenError(action, venueId);
}
