import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoNotice, EmptyState } from "@/components/ui/feedback";
import { isDemoMode } from "@/lib/data/catalog";
import { listMyGuestEntries } from "@/lib/data/orders";
import { formatEventDate, formatTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis listas", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "outline" | "danger"; note?: string }
> = {
  confirmed: {
    label: "Confirmado",
    variant: "success",
    note: "Estás en la lista. El ingreso sigue sujeto al aforo y al horario del local.",
  },
  pending: {
    label: "Pendiente",
    variant: "warning",
    note: "El local aún no decide. Te avisaremos cuando lo haga.",
  },
  rejected: { label: "Rechazado", variant: "danger", note: "El local no aprobó esta solicitud." },
  cancelled: { label: "Cancelado", variant: "outline" },
  used: { label: "Utilizado", variant: "outline", note: "Ya registramos tu ingreso." },
};

export default async function MyGuestListsPage() {
  if (isDemoMode()) {
    return (
      <div className="space-y-4">
        <DemoNotice />
        <EmptyState icon={ClipboardList} title="Sin inscripciones en modo demostración" />
      </div>
    );
  }

  const entries = await listMyGuestEntries();

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No estás en ninguna lista"
        description="Algunos eventos ofrecen listas de invitados con ingreso sin costo antes de cierta hora."
        action={
          <Button asChild>
            <Link href="/eventos">Buscar eventos con lista</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const status = STATUS[entry.status] ?? { label: entry.status, variant: "outline" as const };
        return (
          <li key={entry.id} className="surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-lime">{entry.listName}</p>
                <h2 className="mt-1 truncate font-display text-base font-semibold">
                  <Link href={`/eventos/${entry.event.slug}`} className="hover:text-lime">
                    {entry.event.name}
                  </Link>
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {entry.event.venueName} · {formatEventDate(entry.event.startsAt)}
                </p>
              </div>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>

            <dl className="mt-4 grid gap-2 border-t border-white/5 pt-4 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted">A nombre de</dt>
                <dd className="mt-0.5">{entry.guestName}</dd>
              </div>
              <div>
                <dt className="text-muted">Acompañantes</dt>
                <dd className="mt-0.5">{entry.companions}</dd>
              </div>
              {entry.lastEntryAt ? (
                <div>
                  <dt className="text-muted">Ingreso máximo</dt>
                  <dd className="mt-0.5">{formatTime(entry.lastEntryAt)}</dd>
                </div>
              ) : null}
            </dl>

            {status.note ? <p className="mt-3 text-xs text-muted">{status.note}</p> : null}
            {entry.note ? (
              <p className="mt-2 rounded-lg bg-white/[0.04] p-3 text-xs">
                <span className="text-muted">Nota del local: </span>
                {entry.note}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
