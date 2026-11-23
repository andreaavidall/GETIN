"use client";

import { CalendarClock, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { duplicateEventAction, scheduleEventAction } from "@/lib/actions/venue-tools";
import { formatEventDate, limaISODate } from "@/lib/utils";

/**
 * Duplicar y programar.
 *
 * La fiesta semanal es la misma configuración cada vez. Duplicar copia
 * entradas, mesas y listas —nunca los contadores de vendidas— y la copia nace
 * en borrador: duplicar no es publicar.
 */
export function EventTools({
  venueId,
  eventId,
  eventName,
  startsAt,
  isDraft,
  publishAt,
}: {
  venueId: string;
  eventId: string;
  eventName: string;
  startsAt: Date;
  isDraft: boolean;
  publishAt: Date | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<"cerrado" | "duplicar" | "programar">("cerrado");

  // Por defecto, la misma fiesta la semana que viene.
  const sugerida = limaISODate(new Date(startsAt.getTime() + 7 * 86_400_000));

  function duplicar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await duplicateEventAction({
        venueId,
        eventId,
        date: String(data.get("date") ?? ""),
        copyTables: data.get("copyTables") === "on",
        copyGuestLists: data.get("copyGuestLists") === "on",
      });
      if (!result.ok) {
        toast.error("No se pudo duplicar", { description: result.error });
        return;
      }
      setPanel("cerrado");
      toast.success("Evento duplicado", {
        description: "La copia quedó en borrador: revísala antes de publicar.",
      });
      router.refresh();
    });
  }

  function programar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await scheduleEventAction({
        venueId,
        eventId,
        publishAt: String(data.get("publishAt") ?? ""),
      });
      if (!result.ok) {
        toast.error("No se pudo programar", { description: result.error });
        return;
      }
      setPanel("cerrado");
      toast.success("Publicación programada");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => setPanel(panel === "duplicar" ? "cerrado" : "duplicar")}>
          <Copy className="size-4" />
          Duplicar
        </Button>
        {isDraft ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPanel(panel === "programar" ? "cerrado" : "programar")}
          >
            <CalendarClock className="size-4" />
            {publishAt ? "Reprogramar" : "Programar"}
          </Button>
        ) : null}
      </div>

      {publishAt && isDraft ? (
        <p className="rounded-lg bg-amber-400/[0.07] px-3 py-2 text-[11px] text-amber-100/80">
          Programado para {formatEventDate(publishAt)}. Sigue en borrador hasta que el servidor
          ejecute la publicación programada.
        </p>
      ) : null}

      {panel === "duplicar" ? (
        <form onSubmit={duplicar} className="space-y-3 rounded-xl bg-white/5 p-4" noValidate>
          <p className="text-xs text-muted">
            Copia de <strong className="text-paper">{eventName}</strong> con la misma hora y la
            misma configuración de entradas. Las ventas no se copian.
          </p>
          <Field label="Nueva fecha" htmlFor={`dup-${eventId}`} required>
            <Input id={`dup-${eventId}`} name="date" type="date" defaultValue={sugerida} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name="copyTables" defaultChecked className="size-4 accent-lime" />
            Copiar las mesas y sus precios
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name="copyGuestLists"
              defaultChecked
              className="size-4 accent-lime"
            />
            Copiar las listas de invitados
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Duplicando..." : "Crear copia en borrador"}
          </Button>
        </form>
      ) : null}

      {panel === "programar" ? (
        <form onSubmit={programar} className="space-y-3 rounded-xl bg-white/5 p-4" noValidate>
          <Field
            label="Publicar automáticamente el"
            htmlFor={`sch-${eventId}`}
            hint="Hora de Lima. Déjalo vacío para quitar la programación."
          >
            <Input
              id={`sch-${eventId}`}
              name="publishAt"
              type="datetime-local"
              defaultValue={publishAt ? limaISODate(publishAt) + "T12:00" : ""}
            />
          </Field>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
