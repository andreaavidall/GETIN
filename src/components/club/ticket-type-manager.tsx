"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { createTicketTypeAction, updateTicketTypeAction } from "@/lib/actions/club";
import { ticketTypeFormSchema } from "@/lib/validation/schemas";
import { formatPEN } from "@/lib/utils";

type TicketType = {
  id: string;
  name: string;
  priceCents: number;
  capacity: number;
  soldCount: number;
  heldCount: number;
  isActive: boolean;
};

export function TicketTypeManager({
  venueId,
  eventId,
  ticketTypes,
}: {
  venueId: string;
  eventId: string;
  ticketTypes: TicketType[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggle(type: TicketType) {
    startTransition(async () => {
      const result = await updateTicketTypeAction(venueId, type.id, { isActive: !type.isActive });
      if (!result.ok) {
        toast.error("No se pudo actualizar", { description: result.error });
        return;
      }
      router.refresh();
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors({});

    const parsed = ticketTypeFormSchema.safeParse({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      price: form.get("price") ?? 0,
      capacity: form.get("capacity") ?? 1,
      maxPerOrder: form.get("maxPerOrder") ?? 6,
      salesStartAt: String(form.get("salesStartAt") ?? ""),
      salesEndAt: String(form.get("salesEndAt") ?? ""),
      conditions: String(form.get("conditions") ?? ""),
      isActive: true,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = await createTicketTypeAction(venueId, eventId, parsed.data);
      if (!result.ok) {
        toast.error("No se pudo crear la entrada", { description: result.error });
        return;
      }
      toast.success("Tipo de entrada creado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="p-5">
      {ticketTypes.length === 0 ? (
        <p className="text-sm text-muted">
          Este evento no tiene entradas configuradas. No se puede publicar hasta que tenga al menos
          una activa.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {ticketTypes.map((type) => {
            const available = Math.max(type.capacity - type.soldCount - type.heldCount, 0);
            const pct = type.capacity > 0 ? (type.soldCount / type.capacity) * 100 : 0;

            return (
              <li key={type.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-[180px] flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{type.name}</p>
                    {!type.isActive ? <Badge variant="outline">Inactiva</Badge> : null}
                    {available === 0 ? <Badge variant="danger">Agotada</Badge> : null}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    {type.soldCount} vendidas · {type.heldCount} retenidas · {available} libres de{" "}
                    {type.capacity}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <p className="font-display text-sm font-bold">{formatPEN(type.priceCents)}</p>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => toggle(type)}>
                    {type.isActive ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl bg-white/[0.03] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" htmlFor={`tt-name-${eventId}`} error={errors.name} required>
              <Input id={`tt-name-${eventId}`} name="name" placeholder="General / Preventa / VIP" />
            </Field>
            <Field label="Precio en soles" htmlFor={`tt-price-${eventId}`} error={errors.price} required>
              <Input
                id={`tt-price-${eventId}`}
                name="price"
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                placeholder="70"
              />
            </Field>
            <Field label="Aforo" htmlFor={`tt-cap-${eventId}`} error={errors.capacity} required>
              <Input id={`tt-cap-${eventId}`} name="capacity" type="number" min={1} placeholder="300" />
            </Field>
            <Field label="Maximo por compra" htmlFor={`tt-max-${eventId}`} error={errors.maxPerOrder}>
              <Input
                id={`tt-max-${eventId}`}
                name="maxPerOrder"
                type="number"
                min={1}
                max={50}
                defaultValue={6}
              />
            </Field>
            <Field label="Inicio de venta" htmlFor={`tt-s-${eventId}`} error={errors.salesStartAt}>
              <Input id={`tt-s-${eventId}`} name="salesStartAt" type="datetime-local" />
            </Field>
            <Field label="Fin de venta" htmlFor={`tt-e-${eventId}`} error={errors.salesEndAt}>
              <Input id={`tt-e-${eventId}`} name="salesEndAt" type="datetime-local" />
            </Field>
            <Field
              label="Condiciones"
              htmlFor={`tt-c-${eventId}`}
              error={errors.conditions}
              className="sm:col-span-2"
            >
              <Textarea
                id={`tt-c-${eventId}`}
                name="conditions"
                rows={2}
                placeholder="Valida hasta las 00:30. No incluye consumo."
              />
            </Field>
            <Field label="Descripcion" htmlFor={`tt-d-${eventId}`} className="sm:col-span-2">
              <Input id={`tt-d-${eventId}`} name="description" placeholder="Ingreso a los tres ambientes" />
            </Field>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando..." : "Agregar entrada"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Agregar tipo de entrada
        </Button>
      )}
    </div>
  );
}
