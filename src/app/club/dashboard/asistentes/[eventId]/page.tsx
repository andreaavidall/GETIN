import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireActiveVenue } from "@/lib/auth/guards";
import { getEventAttendees } from "@/lib/data/club";
import { formatTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Asistentes", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Promise<{ eventId: string }>;

export default async function AttendeesPage({ params }: { params: Params }) {
  const { eventId } = await params;
  const { venueId } = await requireActiveVenue();

  // `getEventAttendees` filtra por venue_id y RLS lo vuelve a comprobar: el
  // evento de otro local no devuelve filas aunque se adivine su id.
  const attendees = await getEventAttendees(venueId, eventId);

  return (
    <div className="container space-y-6 py-8">
      <nav className="text-xs text-muted">
        <Link href="/club/dashboard" className="hover:text-paper">
          ← Volver al panel
        </Link>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-3xl">Asistentes</h1>
          <p className="mt-1 text-sm text-muted">
            {attendees.length} entradas emitidas ·{" "}
            {attendees.filter((a) => a.status === "used").length} ya ingresaron
          </p>
        </div>
        <Button asChild variant="secondary">
          <a href={`/api/club/asistentes/${eventId}/csv`} download>
            Descargar CSV
          </a>
        </Button>
      </header>

      {attendees.length === 0 ? (
        <EmptyState
          title="Sin entradas emitidas"
          description="Las entradas aparecen aquí cuando el pago queda confirmado por el proveedor."
        />
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="p-4 font-medium">Serie</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium">Titular</th>
                <th className="p-4 font-medium">Orden</th>
                <th className="p-4 font-medium">Estado</th>
                <th className="p-4 font-medium">Ingreso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {attendees.map((a) => (
                <tr key={a.serial}>
                  <td className="p-4 font-mono text-xs">{a.serial}</td>
                  <td className="p-4">{a.type}</td>
                  <td className="p-4">{a.holder || "—"}</td>
                  <td className="p-4 font-mono text-xs">{a.orderCode}</td>
                  <td className="p-4">
                    <Badge variant={a.status === "used" ? "outline" : "success"}>
                      {a.status === "used" ? "Utilizada" : "Válida"}
                    </Badge>
                  </td>
                  <td className="p-4 text-xs text-muted">
                    {a.usedAt ? formatTime(a.usedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Esta lista contiene datos personales de tus compradores. Tratalos conforme a la Ley 29733:
        usalos solo para el control de acceso del evento y no los compartas con terceros.
      </p>
    </div>
  );
}
