"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { createEventAction } from "@/lib/actions/club";
import { eventFormSchema } from "@/lib/validation/schemas";
import { MUSIC_GENRES } from "@/types/catalog";

export function NewEventForm({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors({});

    const raw = {
      name: String(form.get("name") ?? ""),
      tagline: String(form.get("tagline") ?? ""),
      description: String(form.get("description") ?? ""),
      startsAt: String(form.get("startsAt") ?? ""),
      endsAt: String(form.get("endsAt") ?? ""),
      lastEntryAt: String(form.get("lastEntryAt") ?? ""),
      minAge: form.get("minAge") ?? 18,
      musicGenres: form.getAll("musicGenres").map(String).filter(Boolean),
      entryRules: String(form.get("entryRules") ?? ""),
      cancellationPolicy: String(form.get("cancellationPolicy") ?? ""),
      coverUrl: String(form.get("coverUrl") ?? ""),
    };

    const parsed = eventFormSchema.safeParse(raw);
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
      const result = await createEventAction(venueId, parsed.data);
      if (!result.ok) {
        toast.error("No se pudo crear el evento", { description: result.error });
        return;
      }
      toast.success("Evento creado como borrador", {
        description: "Configura sus entradas y después publicalo.",
      });
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Crear evento
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-5">
      <h3 className="text-display text-lg">Nuevo evento</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="ev-name" error={errors.name} required className="sm:col-span-2">
          <Input id="ev-name" name="name" placeholder="Saturday House" />
        </Field>

        <Field label="Frase corta" htmlFor="ev-tagline" error={errors.tagline} className="sm:col-span-2">
          <Input id="ev-tagline" name="tagline" placeholder="La fiesta de casa, cada sábado" />
        </Field>

        <Field label="Inicio" htmlFor="ev-start" error={errors.startsAt} required>
          <Input id="ev-start" name="startsAt" type="datetime-local" />
        </Field>

        <Field label="Fin" htmlFor="ev-end" error={errors.endsAt}>
          <Input id="ev-end" name="endsAt" type="datetime-local" />
        </Field>

        <Field label="Último ingreso" htmlFor="ev-last" error={errors.lastEntryAt}>
          <Input id="ev-last" name="lastEntryAt" type="datetime-local" />
        </Field>

        <Field label="Edad mínima" htmlFor="ev-age" error={errors.minAge} required>
          <Select id="ev-age" name="minAge" defaultValue="18">
            {[18, 20, 21, 23, 25].map((age) => (
              <option key={age} value={age}>
                {age} años
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Generos musicales"
          htmlFor="ev-genres"
          hint="Mantén Ctrl para elegir varios"
          className="sm:col-span-2"
        >
          <select
            id="ev-genres"
            name="musicGenres"
            multiple
            size={4}
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] p-2 text-sm [&>option]:bg-surface"
          >
            {MUSIC_GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="URL de la portada"
          htmlFor="ev-cover"
          error={errors.coverUrl}
          hint="Pega el enlace de una imagen en horizontal. Se usa como portada del evento."
          className="sm:col-span-2"
        >
          <Input id="ev-cover" name="coverUrl" type="url" placeholder="https://..." />
        </Field>

        <Field label="Descripción" htmlFor="ev-desc" error={errors.description} className="sm:col-span-2">
          <Textarea id="ev-desc" name="description" rows={3} />
        </Field>

        <Field label="Reglas de ingreso" htmlFor="ev-rules" error={errors.entryRules} className="sm:col-span-2">
          <Textarea
            id="ev-rules"
            name="entryRules"
            rows={2}
            placeholder="Documento obligatorio, código de vestimenta, sin reingreso..."
          />
        </Field>

        <Field
          label="Política de cancelación"
          htmlFor="ev-cancel"
          error={errors.cancellationPolicy}
          hint="El comprador la ve antes de pagar y queda guardada en su compra."
          required
          className="sm:col-span-2"
        >
          <Textarea
            id="ev-cancel"
            name="cancellationPolicy"
            rows={2}
            placeholder="Reembolso completo hasta 48 horas antes del evento."
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear como borrador"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
