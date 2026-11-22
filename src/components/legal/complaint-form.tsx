"use client";

import { FileCheck2, Printer } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { submitComplaintAction, type ComplaintResult } from "@/lib/actions/complaints";
import { complaintSchema } from "@/lib/validation/schemas";
import { formatEventDate } from "@/lib/utils";

/**
 * Formulario del Libro de Reclamaciones.
 *
 * Al enviarlo aparece la CONSTANCIA con el número correlativo y la fecha
 * límite de respuesta. Ese número es lo que la norma obliga a entregar al
 * consumidor en el acto, y es el que sirve para reclamar después.
 */
export function ComplaintForm({ defaultEmail, defaultName }: {
  defaultEmail?: string;
  defaultName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Extract<ComplaintResult, { ok: true }> | null>(null);
  const [isMinor, setIsMinor] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors({});

    const raw = {
      kind: String(form.get("kind") ?? "reclamo"),
      goodType: String(form.get("goodType") ?? "servicio"),
      fullName: String(form.get("fullName") ?? ""),
      documentType: String(form.get("documentType") ?? "DNI"),
      documentNumber: String(form.get("documentNumber") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      address: String(form.get("address") ?? ""),
      isMinor: form.get("isMinor") === "on",
      guardianName: String(form.get("guardianName") ?? ""),
      orderCode: String(form.get("orderCode") ?? ""),
      amount: form.get("amount") ? Number(form.get("amount")) : undefined,
      goodDescription: String(form.get("goodDescription") ?? ""),
      detail: String(form.get("detail") ?? ""),
      request: String(form.get("request") ?? ""),
      acceptPrivacy: form.get("acceptPrivacy") === "on",
    };

    const parsed = complaintSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Revisa los campos marcados");
      return;
    }

    startTransition(async () => {
      const result = await submitComplaintAction(parsed.data);
      if (!result.ok) {
        toast.error("No se pudo registrar", { description: result.error });
        setErrors({ form: result.error });
        return;
      }
      setDone(result);
    });
  }

  if (done) {
    return (
      <div className="surface overflow-hidden">
        <div className="flex items-start gap-3 border-b border-lime/30 bg-lime/[0.08] p-5">
          <FileCheck2 className="mt-0.5 size-5 shrink-0 text-lime" />
          <div>
            <h2 className="font-display text-lg font-semibold">Constancia de registro</h2>
            <p className="mt-1 text-sm text-lime/90">
              {/* Concordancia: «el reclamo quedó registrado», «la queja quedó
                  registrada». */}
              {done.kind === "queja"
                ? "Tu queja quedó registrada."
                : "Tu reclamo quedó registrado."}{" "}
              Guarda este número: es el que acredita que la presentaste.
            </p>
          </div>
        </div>

        <dl className="space-y-3 p-5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Número correlativo</dt>
            <dd className="font-mono text-lg font-bold text-lime">{done.correlative}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Tipo</dt>
            <dd className="capitalize">{done.kind}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Fecha de registro</dt>
            <dd>{formatEventDate(new Date(), { withTime: false })}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
            <dt className="font-medium">Respuesta a más tardar</dt>
            <dd className="font-semibold">
              {formatEventDate(done.dueAt, { withTime: false })}
            </dd>
          </div>
        </dl>

        <div className="space-y-3 border-t border-white/10 p-5">
          <p className="text-xs text-muted">
            Enviaremos una copia a <strong className="text-paper">{done.email}</strong>. Si no te
            llega, esta constancia es igual de válida: anota o imprime el número correlativo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.print()} variant="secondary" size="sm">
              <Printer className="size-4" />
              Imprimir constancia
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Volver al inicio</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface space-y-5 p-5" noValidate>
      <div>
        <h2 className="font-display text-lg font-semibold">1. Tipo</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="¿Qué presentas?" htmlFor="lr-kind" error={errors.kind} required>
            <Select id="lr-kind" name="kind" defaultValue="reclamo">
              <option value="reclamo">Reclamo — disconformidad con el servicio</option>
              <option value="queja">Queja — malestar con la atención</option>
            </Select>
          </Field>
          <Field label="Sobre" htmlFor="lr-good" required>
            <Select id="lr-good" name="goodType" defaultValue="servicio">
              <option value="servicio">Un servicio</option>
              <option value="producto">Un producto</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="border-t border-white/10 pt-5">
        <h2 className="font-display text-lg font-semibold">2. Tus datos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nombre completo" htmlFor="lr-name" error={errors.fullName} required
            className="sm:col-span-2">
            <Input id="lr-name" name="fullName" defaultValue={defaultName} autoComplete="name" />
          </Field>
          <Field label="Documento" htmlFor="lr-doctype" required>
            <Select id="lr-doctype" name="documentType" defaultValue="DNI">
              <option value="DNI">DNI</option>
              <option value="CE">Carné de extranjería</option>
              <option value="Pasaporte">Pasaporte</option>
              <option value="RUC">RUC</option>
            </Select>
          </Field>
          <Field label="Número" htmlFor="lr-docnum" error={errors.documentNumber} required>
            <Input id="lr-docnum" name="documentNumber" inputMode="numeric" />
          </Field>
          <Field label="Correo" htmlFor="lr-email" error={errors.email} required>
            <Input id="lr-email" name="email" type="email" defaultValue={defaultEmail} />
          </Field>
          <Field label="Teléfono" htmlFor="lr-phone" error={errors.phone}>
            <Input id="lr-phone" name="phone" type="tel" />
          </Field>
          <Field label="Domicilio" htmlFor="lr-address" error={errors.address}
            className="sm:col-span-2">
            <Input id="lr-address" name="address" autoComplete="street-address" />
          </Field>

          <label className="flex items-start gap-2 text-xs text-muted sm:col-span-2">
            <input
              type="checkbox"
              name="isMinor"
              checked={isMinor}
              onChange={(e) => setIsMinor(e.target.checked)}
              className="mt-0.5 size-4 accent-lime"
            />
            <span>Soy menor de edad</span>
          </label>

          {isMinor ? (
            <Field
              label="Nombre del padre, madre o apoderado"
              htmlFor="lr-guardian"
              error={errors.guardianName}
              required
              className="sm:col-span-2"
            >
              <Input id="lr-guardian" name="guardianName" />
            </Field>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10 pt-5">
        <h2 className="font-display text-lg font-semibold">3. Qué contrataste</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="Código de la orden"
            htmlFor="lr-order"
            error={errors.orderCode}
            hint="Formato GETIN-XXXXXX. Si no lo tienes, déjalo vacío."
          >
            <Input id="lr-order" name="orderCode" placeholder="GETIN-XXXXXX" />
          </Field>
          <Field label="Monto reclamado (S/)" htmlFor="lr-amount" error={errors.amount}>
            <Input id="lr-amount" name="amount" type="number" min={0} step="0.5" />
          </Field>
          <Field
            label="Descripción de lo contratado"
            htmlFor="lr-good-desc"
            error={errors.goodDescription}
            required
            className="sm:col-span-2"
          >
            <Input
              id="lr-good-desc"
              name="goodDescription"
              placeholder="Entrada General para Saturday House en Nocturna Barranco"
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-white/10 pt-5">
        <h2 className="font-display text-lg font-semibold">4. Detalle</h2>
        <div className="mt-3 space-y-3">
          <Field label="Qué ocurrió" htmlFor="lr-detail" error={errors.detail} required>
            <Textarea id="lr-detail" name="detail" rows={5} />
          </Field>
          <Field
            label="Qué solución esperas"
            htmlFor="lr-request"
            error={errors.request}
            required
          >
            <Textarea id="lr-request" name="request" rows={3} />
          </Field>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/10 pt-5">
        <label className="flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" name="acceptPrivacy" className="mt-0.5 size-4 accent-lime" />
          <span>
            Autorizo el tratamiento de mis datos personales para atender esta reclamación,
            conforme a la Ley 29733 y a la{" "}
            <Link href="/legal/privacidad" className="text-lime hover:underline">
              política de privacidad
            </Link>
            .
          </span>
        </label>
        {errors.acceptPrivacy ? (
          <p role="alert" className="text-xs text-red-400">
            {errors.acceptPrivacy}
          </p>
        ) : null}
        {errors.form ? (
          <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
            {errors.form}
          </p>
        ) : null}

        <Button type="submit" full size="lg" disabled={pending}>
          {pending ? "Registrando..." : "Registrar en el Libro de Reclamaciones"}
        </Button>
        <p className="text-xs text-muted">
          Al enviarlo recibirás un número correlativo. GETIN responde en un plazo máximo de
          quince (15) días hábiles.
        </p>
      </div>
    </form>
  );
}
