"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { applyAsVenueAction } from "@/lib/actions/club";
import { venueApplicationSchema } from "@/lib/validation/schemas";
import { LIMA_DISTRICTS, MUSIC_GENRES } from "@/types/catalog";

export function VenueApplicationForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors({});

    const parsed = venueApplicationSchema.safeParse({
      name: String(form.get("name") ?? ""),
      legalName: String(form.get("legalName") ?? ""),
      taxId: String(form.get("taxId") ?? ""),
      district: String(form.get("district") ?? ""),
      address: String(form.get("address") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      capacity: form.get("capacity") ?? 0,
      minAge: form.get("minAge") ?? 18,
      description: String(form.get("description") ?? ""),
      musicGenres: form.getAll("musicGenres").map(String).filter(Boolean),
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
      const result = await applyAsVenueAction(parsed.data);
      if (!result.ok) {
        toast.error("No se pudo enviar la solicitud", { description: result.error });
        return;
      }
      toast.success("Solicitud enviada", {
        description: "Ya puedes preparar tus eventos mientras GETIN revisa la información.",
      });
      router.push("/club/dashboard");
    });
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre comercial" htmlFor="v-name" error={errors.name} required>
          <Input id="v-name" name="name" placeholder="Nocturna Barranco" />
        </Field>

        <Field label="Razon social" htmlFor="v-legal" error={errors.legalName} required>
          <Input id="v-legal" name="legalName" placeholder="Nocturna Entretenimiento SAC" />
        </Field>

        <Field label="RUC" htmlFor="v-ruc" error={errors.taxId} required>
          <Input id="v-ruc" name="taxId" inputMode="numeric" placeholder="20123456789" />
        </Field>

        <Field label="Distrito" htmlFor="v-district" error={errors.district} required>
          <Select id="v-district" name="district" defaultValue="">
            <option value="" disabled>
              Elige un distrito
            </option>
            {LIMA_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Dirección" htmlFor="v-address" error={errors.address} required className="sm:col-span-2">
          <Input id="v-address" name="address" placeholder="Av. Grau 234, Barranco" />
        </Field>

        <Field label="Teléfono de contacto" htmlFor="v-phone" error={errors.phone} required>
          <Input id="v-phone" name="phone" type="tel" placeholder="+51 999 000 000" />
        </Field>

        <Field label="Correo de contacto" htmlFor="v-email" error={errors.email} required>
          <Input id="v-email" name="email" type="email" placeholder="contacto@local.pe" />
        </Field>

        <Field label="Aforo autorizado" htmlFor="v-capacity" error={errors.capacity} required>
          <Input id="v-capacity" name="capacity" type="number" min={10} placeholder="400" />
        </Field>

        <Field label="Edad mínima" htmlFor="v-age" error={errors.minAge} required>
          <Select id="v-age" name="minAge" defaultValue="18">
            {[18, 20, 21, 23, 25].map((age) => (
              <option key={age} value={age}>
                {age} años
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Generos musicales" htmlFor="v-genres" hint="Mantén Ctrl para elegir varios" className="sm:col-span-2">
          <select
            id="v-genres"
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

        <Field label="Descripción del local" htmlFor="v-desc" error={errors.description} className="sm:col-span-2">
          <Textarea id="v-desc" name="description" rows={3} />
        </Field>
      </div>

      <p className="text-xs text-muted">
        Al enviar declaras que estás autorizado a representar al establecimiento. La carga de la
        licencia de funcionamiento y la ficha RUC se habilita en el panel tras el registro.
      </p>

      <Button type="submit" full size="lg" disabled={pending}>
        {pending ? "Enviando..." : "Enviar solicitud"}
      </Button>
    </form>
  );
}
