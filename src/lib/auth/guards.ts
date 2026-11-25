import "server-only";

import { redirect } from "next/navigation";

import { getSession, type Session } from "@/lib/auth/session";
import {
  accessibleVenueIds,
  assertCan,
  can,
  manageableVenueIds,
  type Action,
} from "@/lib/domain/permissions";

/**
 * Guards de servidor. Son la barrera real de autorización de la aplicación:
 * cada página privada y cada server action empieza llamando a uno de estos.
 *
 * Conviven con RLS a proposito: si un día se escapa una consulta sin guard, la
 * base sigue negando; y si una política de RLS se afloja, el guard sigue negando.
 */

/** Exige sesión. Redirige al login conservando el destino. */
export async function requireSession(nextPath?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const target = nextPath ? `/login?siguiente=${encodeURIComponent(nextPath)}` : "/login";
    redirect(target);
  }
  if (session.user.isSuspended) {
    redirect("/cuenta/suspendida");
  }
  return session;
}

/** Exige un permiso concreto; lanza ForbiddenError si no lo tiene. */
export async function requirePermission(action: Action, venueId?: string): Promise<Session> {
  const session = await requireSession();
  assertCan(session.actor, action, venueId);
  return session;
}

/** Exige acceso a un local concreto con el permiso indicado. */
export async function requireVenue(
  venueId: string,
  action: Action = "venue.readDashboard",
): Promise<Session> {
  return requirePermission(action, venueId);
}

/**
 * Para el panel de local: devuelve la sesión y el local activo.
 * Si el usuario no gestiona ninguno, lo manda a crear su solicitud.
 */
export async function requireActiveVenue(preferredVenueId?: string): Promise<{
  session: Session;
  venueId: string;
  venueIds: string[];
}> {
  const session = await requireSession("/club/dashboard");
  // Solo quien manda en el local. El personal de puerta pertenece al local
  // pero su sitio es el escaner, no la caja.
  const venueIds = manageableVenueIds(session.actor);

  if (session.actor.role === "superadmin" && venueIds.length === 0) {
    // El superadmin entra al panel de GETIN, no al de un local.
    redirect("/admin");
  }
  if (venueIds.length === 0) {
    // Si pertenece al local pero solo como puerta, se le manda al escaner en
    // vez de al formulario de registro de un local nuevo.
    if (accessibleVenueIds(session.actor).length > 0) redirect("/puerta");
    redirect("/club/registro");
  }

  const venueId =
    preferredVenueId && venueIds.includes(preferredVenueId) ? preferredVenueId : venueIds[0]!;

  return { session, venueId, venueIds };
}

export async function requireSuperadmin(): Promise<Session> {
  const session = await requireSession("/admin");
  if (session.actor.role !== "superadmin") {
    redirect("/");
  }
  return session;
}

/** Versión no lanzable, para decidir que enseñar en la interfaz. */
export async function hasPermission(action: Action, venueId?: string): Promise<boolean> {
  const session = await getSession();
  return can(session?.actor ?? null, action, venueId);
}
