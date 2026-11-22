"use client";

import { Check, Copy, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { createPlanAction } from "@/lib/actions/plans";

/**
 * Crear un plan desde la ficha del evento.
 *
 * Al crearlo se enseña el enlace y se ofrece copiarlo o mandarlo por
 * WhatsApp: el plan sin repartir no sirve de nada.
 */
export function CreatePlan({
  eventId,
  eventName,
  eventSlug,
  isAuthenticated,
  defaultName,
}: {
  eventId: string;
  eventName: string;
  eventSlug: string;
  isAuthenticated: boolean;
  defaultName: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pending, startTransition] = useTransition();

  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/planes/${token}` : "";

  function abrir() {
    if (!isAuthenticated) {
      router.push(`/login?siguiente=${encodeURIComponent(`/eventos/${eventSlug}`)}`);
      return;
    }
    setAbierto(true);
  }

  function crear(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const goal = String(form.get("goalPeople") ?? "");

    startTransition(async () => {
      const result = await createPlanAction({
        eventId,
        title: String(form.get("title") ?? ""),
        note: String(form.get("note") ?? ""),
        goalPeople: goal ? Number(goal) : undefined,
        displayName: String(form.get("displayName") ?? ""),
      });
      if (!result.ok) {
        toast.error("No se pudo crear el plan", { description: result.error });
        return;
      }
      setToken(result.token);
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("No pudimos copiar el enlace");
    }
  }

  function whatsapp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`¿Vamos a ${eventName}?\n\n${url}`)}`,
      "_blank",
      "noopener",
    );
  }

  if (!abierto) {
    return (
      <Button variant="secondary" size="sm" onClick={abrir}>
        <UsersRound className="size-4" />
        Armar plan con amigos
      </Button>
    );
  }

  return (
    <div className="surface w-full max-w-md space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold">
          {token ? "Plan creado" : "Armar plan con amigos"}
        </h3>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
          className="text-muted hover:text-paper"
        >
          <X className="size-4" />
        </button>
      </div>

      {token ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Pasa este enlace a tu grupo. Quien lo abra puede decir si va, sin necesidad de
            crearse una cuenta.
          </p>
          <p className="break-all rounded-xl bg-white/5 p-3 font-mono text-xs">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={whatsapp}>
              Mandar por WhatsApp
            </Button>
            <Button variant="secondary" size="sm" onClick={copiar}>
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? "Copiado" : "Copiar"}
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={`/planes/${token}`}>Abrir el plan</a>
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={crear} className="space-y-3" noValidate>
          <Field label="Nombre del plan" htmlFor="plan-title" required>
            <Input id="plan-title" name="title" defaultValue={`Vamos a ${eventName}`} />
          </Field>
          <Field label="Te apuntas como" htmlFor="plan-yo" required>
            <Input id="plan-yo" name="displayName" defaultValue={defaultName} placeholder="Tu nombre" />
          </Field>
          <Field
            label="Cuántos buscan ser"
            htmlFor="plan-goal"
            hint="Opcional. Útil si quieren completar una mesa."
          >
            <Select id="plan-goal" name="goalPeople" defaultValue="">
              <option value="">Sin objetivo</option>
              {[2, 4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n} personas
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nota para el grupo" htmlFor="plan-note">
            <Textarea id="plan-note" name="note" rows={2} placeholder="Nos vemos 11:30 en la puerta" />
          </Field>
          <Button type="submit" full disabled={pending}>
            {pending ? "Creando..." : "Crear y obtener enlace"}
          </Button>
        </form>
      )}
    </div>
  );
}
