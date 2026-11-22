"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { joinGuestListAction } from "@/lib/actions/checkout";
import { formatEventDate, formatTime } from "@/lib/utils";
import type { GuestListView } from "@/types/catalog";

export function GuestListPanel({
  list,
  eventSlug,
  isAuthenticated,
  demoMode,
  defaultName,
}: {
  list: GuestListView;
  eventSlug: string;
  isAuthenticated: boolean;
  demoMode: boolean;
  defaultName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [companions, setCompanions] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const spotsLeft = Math.max(list.capacity - list.confirmedCount, 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await joinGuestListAction({
        guestListId: list.id,
        guestName: name,
        companions,
        acceptConditions: accepted,
      });
      if (!result.ok) {
        toast.error("No se pudo inscribir", { description: result.error });
        return;
      }
      setDone(result.status);
      toast.success(
        result.status === "confirmed"
          ? "Estás en la lista"
          : "Solicitud enviada: el local la revisara",
      );
    });
  }

  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <ClipboardList className="size-4 text-lime" />
            {list.name}
          </h3>
          {list.description ? (
            <p className="mt-1 text-sm text-muted">{list.description}</p>
          ) : null}
        </div>
        <Badge variant={spotsLeft > 0 && list.isOpen ? "success" : "danger"}>
          {!list.isOpen ? "Cerrada" : spotsLeft > 0 ? `${spotsLeft} cupos` : "Sin cupos"}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-2 border-t border-white/5 pt-4 text-xs sm:grid-cols-2">
        {list.signupDeadline ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Inscripción hasta</dt>
            <dd className="text-right">{formatEventDate(list.signupDeadline)}</dd>
          </div>
        ) : null}
        {list.lastEntryAt ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Ingreso máximo</dt>
            <dd className="text-right">{formatTime(list.lastEntryAt)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Aprobación</dt>
          <dd className="text-right">{list.autoApprove ? "Automática" : "Manual del local"}</dd>
        </div>
        {list.benefits ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Beneficio</dt>
            <dd className="text-right">{list.benefits}</dd>
          </div>
        ) : null}
      </dl>

      {list.conditions ? (
        <p className="mt-3 rounded-lg bg-amber-400/[0.07] p-3 text-[11px] text-amber-100/80">
          {list.conditions}
        </p>
      ) : null}

      {done ? (
        <p className="mt-4 rounded-lg bg-lime/10 p-3 text-sm text-lime">
          {done === "confirmed"
            ? "Inscripción confirmada. Puedes verla en «Mis listas»."
            : "Solicitud registrada como pendiente. El local decidira antes del cierre."}
        </p>
      ) : list.isOpen && spotsLeft > 0 ? (
        !demoMode && isAuthenticated ? (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <Field label="Nombre con el que entras" htmlFor={`gl-name-${list.id}`} required>
                <Input
                  id={`gl-name-${list.id}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={3}
                  placeholder="Nombre y apellido"
                />
              </Field>
              <Field label="Acompañantes" htmlFor={`gl-comp-${list.id}`}>
                <Select
                  id={`gl-comp-${list.id}`}
                  value={String(companions)}
                  onChange={(e) => setCompanions(Number(e.target.value))}
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 size-4 accent-lime"
                required
              />
              <span>
                Entiendo que la inscripción no garantiza el ingreso y que depende del cupo, del
                horario y del criterio de admisión del local.
              </span>
            </label>

            <Button type="submit" full size="sm" disabled={pending || !accepted}>
              {pending ? "Enviando..." : "Apuntarme a la lista"}
            </Button>
          </form>
        ) : demoMode ? (
          <div className="mt-4">
            <Button full size="sm" variant="outline" disabled>
              Inscripciones no disponibles en la demostración
            </Button>
            <p className="mt-1.5 text-[11px] text-muted">
              Esta instalación usa un catálogo de ejemplo y no admite inscripciones reales.
            </p>
          </div>
        ) : (
          <Button asChild full size="sm" className="mt-4">
            <Link href={`/login?siguiente=${encodeURIComponent(`/eventos/${eventSlug}#listas`)}`}>
              Inicia sesión para apuntarte
            </Link>
          </Button>
        )
      ) : null}
    </div>
  );
}
