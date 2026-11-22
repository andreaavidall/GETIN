import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getEventAttendees } from "@/lib/data/club";
import { accessibleVenueIds, can } from "@/lib/domain/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Exportacion CSV de asistentes.
 *
 * Comprueba que el evento pertenece a un local del usuario ANTES de leer nada,
 * y pide el permiso `venue.exportReports` (solo owner/manager: el personal de
 * puerta no descarga la lista de compradores).
 */
export const dynamic = "force-dynamic";

/** Escapa un valor para CSV y neutraliza la inyeccion de formulas en Excel. */
function csvCell(value: string | null): string {
  const raw = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "necesitas iniciar sesión" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, venue_id, starts_at")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "evento no encontrado" }, { status: 404 });
  }

  const venueId = event.venue_id as string;
  if (
    !accessibleVenueIds(session.actor).includes(venueId) ||
    !can(session.actor, "venue.exportReports", venueId)
  ) {
    return NextResponse.json({ error: "sin permiso" }, { status: 403 });
  }

  const attendees = await getEventAttendees(venueId, eventId);

  const header = [
    "serie",
    "tipo_entrada",
    "titular",
    "correo_comprador",
    "orden",
    "estado",
    "ingreso_utc",
    "emitida_utc",
  ];

  const lines = [
    header.join(","),
    ...attendees.map((a) =>
      [
        csvCell(a.serial),
        csvCell(a.type),
        csvCell(a.holder),
        csvCell(a.buyerEmail),
        csvCell(a.orderCode),
        csvCell(a.status),
        csvCell(a.usedAt),
        csvCell(a.createdAt),
      ].join(","),
    ),
  ];

  const slug = String(event.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      // BOM + UTF-8 para que Excel en Windows abra los acentos bien.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="asistentes-${slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
