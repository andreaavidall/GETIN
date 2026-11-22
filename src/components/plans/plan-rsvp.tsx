"use client";

import { Check, Link2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { closePlanAction, rsvpPlanAction } from "@/lib/actions/plans";
import type { PlanMemberView } from "@/lib/data/plans";
import { cn } from "@/lib/utils";

const ETIQUETA: Record<PlanMemberView["rsvp"], string> = {
  va: "Va",
  quiza: "Quizá",
  no: "No puede",
};

/**
 * Responder a un plan.
 *
 * Se puede responder sin cuenta: para decir "voy" no hace falta registrarse,
 * y obligar a ello es la forma más rápida de que el grupo se vuelva al chat.
 * Comprar la entrada sí necesita cuenta, y eso se dice aparte.
 */
export function PlanRsvp({
  token,
  defaultName,
  myRsvp,
  closed,
  createdByMe,
}: {
  token: string;
  defaultName: string;
  myRsvp: PlanMemberView | null;
  closed: boolean;
  createdByMe: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copiado, setCopiado] = useState(false);

  function responder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await rsvpPlanAction({
        token,
        displayName: String(form.get("displayName") ?? ""),
        rsvp: String(form.get("rsvp") ?? "va"),
        companions: Number(form.get("companions") ?? 0),
      });
      if (!result.ok) {
        toast.error("No se pudo guardar", { description: result.error });
        return;
      }
      toast.success("Respuesta guardada");
      router.refresh();
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("No pudimos copiar el enlace");
    }
  }

  function whatsapp() {
    const texto = `${document.title}\n\n${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  }

  function cerrar() {
    startTransition(async () => {
      const result = await closePlanAction(token);
      if (!result.ok) {
        toast.error("No se pudo cerrar", { description: result.error });
        return;
      }
      toast.success("Plan cerrado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copiar}>
          {copiado ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {copiado ? "Copiado" : "Copiar enlace"}
        </Button>
        <Button variant="secondary" size="sm" onClick={whatsapp}>
          Compartir por WhatsApp
        </Button>
        {createdByMe && !closed ? (
          <Button variant="ghost" size="sm" onClick={cerrar} disabled={pending}>
            <Lock className="size-4" />
            Cerrar plan
          </Button>
        ) : null}
      </div>

      {closed ? (
        <p className="surface p-4 text-sm text-muted">
          Este plan está cerrado: ya no se admiten respuestas nuevas.
        </p>
      ) : (
        <form onSubmit={responder} className="surface space-y-4 p-5" noValidate>
          <h2 className="font-display text-base font-semibold">
            {myRsvp ? "Cambiar mi respuesta" : "¿Te apuntas?"}
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tu nombre" htmlFor="plan-nombre" required className="sm:col-span-2">
              <Input
                id="plan-nombre"
                name="displayName"
                defaultValue={myRsvp?.displayName ?? defaultName}
                placeholder="Como te conocen tus amigos"
              />
            </Field>
            <Field label="Respuesta" htmlFor="plan-rsvp" required>
              <Select id="plan-rsvp" name="rsvp" defaultValue={myRsvp?.rsvp ?? "va"}>
                <option value="va">Voy</option>
                <option value="quiza">Quizá</option>
                <option value="no">No puedo</option>
              </Select>
            </Field>
            <Field
              label="Llevo a"
              htmlFor="plan-acompanantes"
              hint="Personas además de ti"
            >
              <Select
                id="plan-acompanantes"
                name="companions"
                defaultValue={String(myRsvp?.companions ?? 0)}
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Button type="submit" full disabled={pending}>
            {pending ? "Guardando..." : myRsvp ? "Actualizar" : "Apuntarme"}
          </Button>
          <p className="text-[11px] text-muted">
            Apuntarte aquí no compra ni reserva nada: sirve para saber cuántos son. Cada quien
            compra su entrada en la página del evento.
          </p>
        </form>
      )}
    </div>
  );
}

export function RsvpBadge({ rsvp }: { rsvp: PlanMemberView["rsvp"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        rsvp === "va"
          ? "bg-lime/15 text-lime"
          : rsvp === "quiza"
            ? "bg-amber-400/15 text-amber-200"
            : "bg-white/5 text-muted",
      )}
    >
      {ETIQUETA[rsvp]}
    </span>
  );
}
