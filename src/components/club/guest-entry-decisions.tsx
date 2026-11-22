"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { decideGuestEntryAction } from "@/lib/actions/club";

type Entry = {
  id: string;
  guestName: string;
  companions: number;
  listName: string;
  eventName: string;
};

export function GuestEntryDecisions({ venueId, entries }: { venueId: string; entries: Entry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(entryId: string, approve: boolean) {
    startTransition(async () => {
      const result = await decideGuestEntryAction(venueId, entryId, approve);
      if (!result.ok) {
        toast.error("No se pudo registrar la decisión", { description: result.error });
        return;
      }
      toast.success(approve ? "Invitado confirmado" : "Solicitud rechazada");
      router.refresh();
    });
  }

  return (
    <ul className="surface divide-y divide-white/5">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{entry.guestName}</p>
            <p className="mt-0.5 text-xs text-muted">
              {entry.listName} · {entry.eventName}
              {entry.companions > 0 ? ` · +${entry.companions} acompañantes` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => decide(entry.id, true)}>
              <Check className="size-4" />
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => decide(entry.id, false)}
            >
              <X className="size-4" />
              Rechazar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
