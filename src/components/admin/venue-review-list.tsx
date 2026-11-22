"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { decideVenueAction } from "@/lib/actions/admin";
import { formatShortDate } from "@/lib/utils";

type Venue = {
  id: string;
  name: string;
  district: string;
  status: string;
  tax_id: string | null;
  legal_name: string | null;
  created_at: string;
};

export function VenueReviewList({ venues }: { venues: Venue[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});

  function decide(venueId: string, decisión: "approve" | "reject") {
    startTransition(async () => {
      const result = await decideVenueAction(venueId, decisión, notes[venueId]);
      if (!result.ok) {
        toast.error("No se pudo registrar la decisión", { description: result.error });
        return;
      }
      toast.success(decisión === "approve" ? "Local aprobado y publicado" : "Solicitud rechazada");
      router.refresh();
    });
  }

  return (
    <ul className="space-y-3">
      {venues.map((venue) => (
        <li key={venue.id} className="surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-semibold">{venue.name}</h3>
                <Badge variant="warning">
                  {venue.status === "draft" ? "Borrador" : "En revisión"}
                </Badge>
              </div>
              <dl className="mt-2 space-y-1 text-xs text-muted">
                <div>
                  <dt className="inline">Razon social: </dt>
                  <dd className="inline text-paper">{venue.legal_name ?? "no indicada"}</dd>
                </div>
                <div>
                  <dt className="inline">RUC: </dt>
                  <dd className="inline font-mono text-paper">{venue.tax_id ?? "no indicado"}</dd>
                </div>
                <div>
                  <dt className="inline">Distrito: </dt>
                  <dd className="inline text-paper">{venue.district}</dd>
                </div>
                <div>
                  <dt className="inline">Solicitado: </dt>
                  <dd className="inline">{formatShortDate(venue.created_at)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <Textarea
            rows={2}
            className="mt-4"
            placeholder="Notas de la revisión (quedan en el expediente y en la auditoria)"
            value={notes[venue.id] ?? ""}
            onChange={(e) => setNotes((prev) => ({ ...prev, [venue.id]: e.target.value }))}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => decide(venue.id, "approve")}>
              Aprobar y publicar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => decide(venue.id, "reject")}
            >
              Rechazar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
