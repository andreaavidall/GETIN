"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import {
  addVenuePhotoAction,
  createPromotionAction,
  removeVenuePhotoAction,
  togglePromotionAction,
  updateTablePositionsAction,
  updateVenueProfileAction,
} from "@/lib/actions/venue-profile";
import { formatEventDate } from "@/lib/utils";

type Foto = { id: string; url: string; alt: string | null; kind: string };
type Promo = {
  id: string;
  title: string;
  description: string;
  conditions: string;
  endsAt: Date | null;
  isActive: boolean;
  eventName: string | null;
};
type Mesa = {
  id: string;
  label: string;
  zone: string | null;
  x: number | null;
  y: number | null;
  /** Personas cuyo ingreso cubre la mesa; null = sin declarar. */
  entrada: number | null;
};

/**
 * Ficha del local, editable por el propio local.
 *
 * Todos los campos son opcionales y ninguno se rellena solo: lo que el local
 * no escriba, en la ficha pública no aparece.
 */
export function VenueProfileForm({
  venueId,
  ambiences,
  accessibility,
  parking,
  entranceNotes,
  dressCode,
}: {
  venueId: string;
  ambiences: string[];
  accessibility: string | null;
  parking: string | null;
  entranceNotes: string | null;
  dressCode: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateVenueProfileAction({
        venueId,
        ambiences: String(form.get("ambiences") ?? ""),
        accessibility: String(form.get("accessibility") ?? ""),
        parking: String(form.get("parking") ?? ""),
        entranceNotes: String(form.get("entranceNotes") ?? ""),
        dressCode: String(form.get("dressCode") ?? ""),
      });
      if (!result.ok) {
        toast.error("No se pudo guardar", { description: result.error });
        return;
      }
      toast.success("Ficha actualizada");
      router.refresh();
    });
  }

  return (
    <form onSubmit={guardar} className="surface space-y-4 p-5" noValidate>
      <div>
        <h2 className="font-display text-base font-semibold">Cómo es tu local</h2>
        <p className="mt-1 text-xs text-muted">
          Esto es lo que más usa la gente para decidir. Lo que dejes vacío no se muestra: no
          inventamos nada por ti.
        </p>
      </div>

      <Field
        label="Ambientes"
        htmlFor="vp-amb"
        hint="Separados por comas: terraza, pista, zona para sentarse"
      >
        <Input id="vp-amb" name="ambiences" defaultValue={ambiences.join(", ")} />
      </Field>

      <Field label="Accesibilidad" htmlFor="vp-acc" hint="Rampa, ascensor, baño adaptado...">
        <Textarea id="vp-acc" name="accessibility" rows={2} defaultValue={accessibility ?? ""} />
      </Field>

      <Field label="Estacionamiento" htmlFor="vp-park">
        <Textarea id="vp-park" name="parking" rows={2} defaultValue={parking ?? ""} />
      </Field>

      <Field label="Punto de ingreso" htmlFor="vp-ent" hint="Por dónde se entra y por dónde va la cola">
        <Textarea id="vp-ent" name="entranceNotes" rows={2} defaultValue={entranceNotes ?? ""} />
      </Field>

      <Field label="Código de vestimenta" htmlFor="vp-dress">
        <Input id="vp-dress" name="dressCode" defaultValue={dressCode ?? ""} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar ficha"}
      </Button>
    </form>
  );
}

/** Fotos por dirección de imagen. Sin subida de archivos todavía. */
export function VenuePhotosForm({ venueId, photos }: { venueId: string; photos: Foto[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function añadir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await addVenuePhotoAction({
        venueId,
        url: String(data.get("url") ?? ""),
        alt: String(data.get("alt") ?? ""),
        kind: String(data.get("kind") ?? "ambiente"),
      });
      if (!result.ok) {
        toast.error("No se pudo añadir", { description: result.error });
        return;
      }
      form.reset();
      toast.success("Foto añadida");
      router.refresh();
    });
  }

  function quitar(photoId: string) {
    startTransition(async () => {
      const result = await removeVenuePhotoAction(venueId, photoId);
      if (!result.ok) {
        toast.error("No se pudo quitar", { description: result.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="surface space-y-4 p-5">
      <div>
        <h2 className="font-display text-base font-semibold">Fotos del local</h2>
        <p className="mt-1 text-xs text-muted">
          Fotos reales del ambiente y de las mesas. Mientras no subas ninguna, la ficha dice que
          no hay fotos en vez de enseñar imágenes de archivo.
        </p>
      </div>

      {photos.length > 0 ? (
        <ul className="space-y-2">
          {photos.map((photo) => (
            <li key={photo.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="size-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-muted">{photo.kind}</p>
                <p className="truncate text-xs">{photo.alt ?? photo.url}</p>
              </div>
              <button
                type="button"
                onClick={() => quitar(photo.id)}
                disabled={pending}
                aria-label="Quitar foto"
                className="text-muted transition-colors hover:text-red-400"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={añadir} className="grid gap-3 sm:grid-cols-[1fr_auto]" noValidate>
        <div className="space-y-3">
          <Field label="Dirección de la imagen" htmlFor="vf-url" required>
            <Input id="vf-url" name="url" type="url" placeholder="https://..." />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Descripción" htmlFor="vf-alt" hint="Para quien no ve la imagen">
              <Input id="vf-alt" name="alt" placeholder="Terraza con vista al malecón" />
            </Field>
            <Field label="Tipo" htmlFor="vf-kind">
              <Select id="vf-kind" name="kind" defaultValue="ambiente">
                <option value="ambiente">Ambiente</option>
                <option value="mesa">Mesa</option>
                <option value="fachada">Fachada</option>
              </Select>
            </Field>
          </div>
        </div>
        <Button type="submit" variant="secondary" disabled={pending} className="self-end">
          <Plus className="size-4" />
          Añadir
        </Button>
      </form>
    </div>
  );
}

/** Promociones: el beneficio y sus condiciones, que son obligatorias. */
export function PromotionsForm({
  venueId,
  promotions,
  events,
}: {
  venueId: string;
  promotions: Promo[];
  events: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);

  function crear(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createPromotionAction({
        venueId,
        eventId: String(data.get("eventId") ?? "") || undefined,
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        conditions: String(data.get("conditions") ?? ""),
        endsAt: String(data.get("endsAt") ?? "") || undefined,
      });
      if (!result.ok) {
        toast.error("No se pudo crear", { description: result.error });
        return;
      }
      form.reset();
      setAbierto(false);
      toast.success("Beneficio publicado");
      router.refresh();
    });
  }

  function alternar(promotionId: string, active: boolean) {
    startTransition(async () => {
      const result = await togglePromotionAction(venueId, promotionId, active);
      if (!result.ok) {
        toast.error("No se pudo cambiar", { description: result.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="surface space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Sparkles className="size-4 text-lime" />
            Beneficios
          </h2>
          <p className="mt-1 max-w-md text-xs text-muted">
            Preventas, promociones o beneficios para grupos. Las condiciones son obligatorias:
            son lo que evita la discusión en la puerta.
          </p>
        </div>
        {!abierto ? (
          <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
            <Plus className="size-4" />
            Publicar beneficio
          </Button>
        ) : null}
      </div>

      {promotions.length > 0 ? (
        <ul className="space-y-2">
          {promotions.map((promo) => (
            <li key={promo.id} className="rounded-xl bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{promo.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{promo.description}</p>
                  <p className="mt-1 text-xs text-muted">Condiciones: {promo.conditions}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {promo.eventName ? `Solo para ${promo.eventName}` : "Para todos los eventos"}
                    {promo.endsAt
                      ? ` · hasta el ${formatEventDate(promo.endsAt, { withTime: false })}`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => alternar(promo.id, !promo.isActive)}
                  disabled={pending}
                >
                  {promo.isActive ? "Despublicar" : "Publicar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {abierto ? (
        <form onSubmit={crear} className="space-y-3 border-t border-white/10 pt-4" noValidate>
          <Field label="Título" htmlFor="pr-title" required>
            <Input id="pr-title" name="title" placeholder="Preventa para seguidores" />
          </Field>
          <Field label="En qué consiste" htmlFor="pr-desc" required>
            <Textarea id="pr-desc" name="description" rows={2} />
          </Field>
          <Field
            label="Condiciones"
            htmlFor="pr-cond"
            required
            hint="Qué hace falta, qué no incluye, hasta cuándo"
          >
            <Textarea id="pr-cond" name="conditions" rows={2} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Evento" htmlFor="pr-event" hint="Vacío = todos tus eventos">
              <Select id="pr-event" name="eventId" defaultValue="">
                <option value="">Todos</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Válido hasta" htmlFor="pr-ends">
              <Input id="pr-ends" name="endsAt" type="date" />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Publicando..." : "Publicar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/** Colocar las mesas en el plano, en porcentaje del salón. */
export function TablePositionsForm({ venueId, tables }: { venueId: string; tables: Mesa[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const faltan = tables.filter((t) => t.x === null || t.y === null).length;

  // Dos mesas demasiado juntas se dibujan encima la una de la otra y dejan de
  // poder tocarse por separado en un telefono. Mas vale decirlo aqui, donde
  // tiene arreglo, que dejar un plano que no se puede usar.
  const colocadas = tables.filter((t) => t.x !== null && t.y !== null);
  const juntas: string[] = [];
  for (let i = 0; i < colocadas.length; i++) {
    for (let j = i + 1; j < colocadas.length; j++) {
      const a = colocadas[i]!;
      const b = colocadas[j]!;
      // La vertical se convierte con la proporcion 4:3 del plano.
      const d = Math.hypot((a.x! - b.x!), (a.y! - b.y!) * 0.75);
      if (d < 10) juntas.push(`${a.label} y ${b.label}`);
    }
  }

  function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const positions = tables
      .map((t) => ({
        id: t.id,
        x: data.get(`x-${t.id}`),
        y: data.get(`y-${t.id}`),
      }))
      .filter((p) => p.x !== null && p.x !== "" && p.y !== null && p.y !== "")
      .map((p) => ({ id: p.id, x: Number(p.x), y: Number(p.y) }));

    const entries = tables.map((t) => {
      const valor = String(data.get(`e-${t.id}`) ?? "");
      return { id: t.id, includesEntryFor: valor === "" ? null : Number(valor) };
    });

    startTransition(async () => {
      const result = await updateTablePositionsAction({ venueId, positions, entries });
      if (!result.ok) {
        toast.error("No se pudo guardar", { description: result.error });
        return;
      }
      toast.success("Plano actualizado");
      router.refresh();
    });
  }

  if (tables.length === 0) return null;

  return (
    <form onSubmit={guardar} className="surface space-y-4 p-5" noValidate>
      <div>
        <h2 className="font-display text-base font-semibold">Mesas: plano e ingreso</h2>
        <p className="mt-1 text-xs text-muted">
          Posición de cada mesa en porcentaje del salón: 0 % es arriba a la izquierda, 100 % abajo
          a la derecha. La pista se dibuja abajo. El plano solo se muestra al público cuando
          <strong className="text-paper"> todas </strong>
          las mesas tienen posición.
          {faltan > 0 ? ` Faltan ${faltan}.` : " Ya están todas."}
        </p>
        <p className="mt-2 text-xs text-muted">
          «Ingreso incluido para» responde la primera pregunta de quien reserva para un grupo.
          Déjalo vacío si prefieres no declararlo: la ficha dirá que no lo has indicado, que no
          es lo mismo que declarar <strong className="text-paper">0</strong>, con lo que cada
          persona compra su entrada aparte.
        </p>
      </div>

      {juntas.length > 0 ? (
        <p className="rounded-lg bg-amber-400/[0.07] px-3 py-2 text-xs text-amber-100/80">
          Estas mesas quedan demasiado juntas en el plano y se encimarán en un teléfono:{" "}
          <strong>{juntas.join("; ")}</strong>. Sepáralas al menos un 10 % para que se puedan
          tocar por separado.
        </p>
      ) : null}

      <ul className="space-y-2">
        {tables.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-3">
            <span className="min-w-0 flex-1 text-sm">
              {t.label}
              {t.zone ? <span className="ml-1.5 text-xs text-muted">{t.zone}</span> : null}
            </span>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              X
              <Input
                name={`x-${t.id}`}
                type="number"
                min={0}
                max={100}
                defaultValue={t.x ?? ""}
                className="h-9 w-20"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Y
              <Input
                name={`y-${t.id}`}
                type="number"
                min={0}
                max={100}
                defaultValue={t.y ?? ""}
                className="h-9 w-20"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Ingreso incluido para
              <Input
                name={`e-${t.id}`}
                type="number"
                min={0}
                max={50}
                placeholder="—"
                defaultValue={t.entrada ?? ""}
                className="h-9 w-20"
              />
              personas
            </label>
          </li>
        ))}
      </ul>

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar plano"}
      </Button>
    </form>
  );
}
