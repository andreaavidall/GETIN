import { describe, expect, it } from "vitest";

import {
  accessibleVenueIds,
  assertCan,
  can,
  defaultLandingPath,
  ForbiddenError,
  isSuperadmin,
  membershipFor,
  UnauthenticatedError,
  type Actor,
} from "@/lib/domain/permissions";

/**
 * Control de acceso por roles.
 *
 * Lo central: un local no puede ver ni tocar lo de otro, y el personal de
 * puerta no puede administrar. Se prueba tambien el caso de "permiso sin
 * indicar local", que debe denegarse.
 */

const VENUE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const VENUE_B = "bbbbbbbb-0000-4000-8000-000000000002";

const client: Actor = {
  userId: "u-client",
  role: "client",
  isSuspended: false,
  memberships: [],
};

const owner: Actor = {
  userId: "u-owner",
  role: "club_admin",
  isSuspended: false,
  memberships: [{ venueId: VENUE_A, role: "owner", isActive: true }],
};

const manager: Actor = {
  userId: "u-manager",
  role: "club_admin",
  isSuspended: false,
  memberships: [{ venueId: VENUE_A, role: "manager", isActive: true }],
};

const door: Actor = {
  userId: "u-door",
  role: "door_staff",
  isSuspended: false,
  memberships: [{ venueId: VENUE_A, role: "door", isActive: true }],
};

const superadmin: Actor = {
  userId: "u-admin",
  role: "superadmin",
  isSuspended: false,
  memberships: [],
};

describe("catalogo publico", () => {
  it("cualquiera puede leer el catalogo, incluso sin sesion", () => {
    expect(can(null, "catalog.read")).toBe(true);
    expect(can(client, "catalog.read")).toBe(true);
  });

  it("sin sesion no se puede hacer nada mas", () => {
    expect(can(null, "order.create")).toBe(false);
    expect(can(null, "door.scan", VENUE_A)).toBe(false);
    expect(can(null, "admin.approveVenues")).toBe(false);
    expect(can(null, "venue.manageEvents", VENUE_A)).toBe(false);
  });
});

describe("aislamiento entre locales", () => {
  it("el dueño de un local no puede gestionar otro", () => {
    expect(can(owner, "venue.manageEvents", VENUE_A)).toBe(true);
    expect(can(owner, "venue.manageEvents", VENUE_B)).toBe(false);
    expect(can(owner, "venue.readDashboard", VENUE_B)).toBe(false);
    expect(can(owner, "venue.readPayments", VENUE_B)).toBe(false);
    expect(can(owner, "door.scan", VENUE_B)).toBe(false);
  });

  it("sin indicar el local se deniega (no vale 'en alguno de mis locales')", () => {
    expect(can(owner, "venue.manageEvents")).toBe(false);
    expect(can(owner, "venue.readDashboard")).toBe(false);
    expect(can(door, "door.scan")).toBe(false);
  });

  it("una pertenencia desactivada no da acceso", () => {
    const former: Actor = {
      ...owner,
      memberships: [{ venueId: VENUE_A, role: "owner", isActive: false }],
    };
    expect(can(former, "venue.manageEvents", VENUE_A)).toBe(false);
    expect(can(former, "door.scan", VENUE_A)).toBe(false);
    expect(membershipFor(former, VENUE_A)).toBeNull();
    expect(accessibleVenueIds(former)).toEqual([]);
  });
});

describe("personal de puerta", () => {
  it("puede escanear en su local", () => {
    expect(can(door, "door.scan", VENUE_A)).toBe(true);
  });

  it("no puede administrar ni ver los pagos", () => {
    expect(can(door, "venue.manageEvents", VENUE_A)).toBe(false);
    expect(can(door, "venue.manageTickets", VENUE_A)).toBe(false);
    expect(can(door, "venue.manageStaff", VENUE_A)).toBe(false);
    expect(can(door, "venue.readPayments", VENUE_A)).toBe(false);
    expect(can(door, "venue.exportReports", VENUE_A)).toBe(false);
  });

  it("si puede ver el panel y los asistentes de su local", () => {
    expect(can(door, "venue.readDashboard", VENUE_A)).toBe(true);
    expect(can(door, "venue.readAttendees", VENUE_A)).toBe(true);
  });

  it("puede comprar como cualquier cliente", () => {
    expect(can(door, "order.create")).toBe(true);
  });
});

describe("gerente y dueño", () => {
  it("el gerente gestiona eventos y entradas pero no el personal", () => {
    expect(can(manager, "venue.manageEvents", VENUE_A)).toBe(true);
    expect(can(manager, "venue.manageTickets", VENUE_A)).toBe(true);
    expect(can(manager, "venue.manageTables", VENUE_A)).toBe(true);
    expect(can(manager, "venue.manageStaff", VENUE_A)).toBe(false);
  });

  it("solo el dueño gestiona el personal", () => {
    expect(can(owner, "venue.manageStaff", VENUE_A)).toBe(true);
  });

  it("ningun rol de local accede al panel de GETIN", () => {
    for (const actor of [owner, manager, door, client]) {
      expect(can(actor, "admin.approveVenues")).toBe(false);
      expect(can(actor, "admin.configureCommissions")).toBe(false);
      expect(can(actor, "admin.readAudit")).toBe(false);
      expect(can(actor, "admin.decideRefunds")).toBe(false);
    }
  });
});

describe("superadministrador", () => {
  it("puede todo, incluidos los locales de los que no es staff", () => {
    expect(isSuperadmin(superadmin)).toBe(true);
    expect(can(superadmin, "admin.approveVenues")).toBe(true);
    expect(can(superadmin, "venue.manageEvents", VENUE_B)).toBe(true);
    expect(can(superadmin, "door.scan", VENUE_B)).toBe(true);
  });
});

describe("cuentas suspendidas", () => {
  it("una cuenta suspendida no puede hacer nada (ni siendo superadmin)", () => {
    const suspendedClient: Actor = { ...client, isSuspended: true };
    const suspendedAdmin: Actor = { ...superadmin, isSuspended: true };
    const suspendedOwner: Actor = { ...owner, isSuspended: true };

    expect(can(suspendedClient, "order.create")).toBe(false);
    expect(can(suspendedAdmin, "admin.approveVenues")).toBe(false);
    expect(isSuperadmin(suspendedAdmin)).toBe(false);
    expect(can(suspendedOwner, "venue.manageEvents", VENUE_A)).toBe(false);
    expect(accessibleVenueIds(suspendedOwner)).toEqual([]);
  });

  it("pero sigue pudiendo leer el catalogo publico", () => {
    expect(can({ ...client, isSuspended: true }, "catalog.read")).toBe(true);
  });
});

describe("assertCan", () => {
  it("lanza UnauthenticatedError sin sesion", () => {
    expect(() => assertCan(null, "order.create")).toThrow(UnauthenticatedError);
  });

  it("lanza ForbiddenError cuando falta el permiso", () => {
    expect(() => assertCan(door, "venue.manageEvents", VENUE_A)).toThrow(ForbiddenError);
    expect(() => assertCan(owner, "venue.manageEvents", VENUE_B)).toThrow(/VENUE_B|bbbb/);
  });

  it("no lanza cuando el permiso existe", () => {
    expect(() => assertCan(owner, "venue.manageEvents", VENUE_A)).not.toThrow();
    expect(() => assertCan(null, "catalog.read")).not.toThrow();
  });
});

describe("defaultLandingPath", () => {
  it("lleva a cada rol a su sitio", () => {
    expect(defaultLandingPath(null)).toBe("/");
    expect(defaultLandingPath(client)).toBe("/cuenta");
    expect(defaultLandingPath(owner)).toBe("/club/dashboard");
    expect(defaultLandingPath(manager)).toBe("/club/dashboard");
    expect(defaultLandingPath(door)).toBe("/puerta");
    expect(defaultLandingPath(superadmin)).toBe("/admin");
  });
});
