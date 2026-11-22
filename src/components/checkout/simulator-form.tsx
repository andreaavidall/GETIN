"use client";

import { CreditCard, Lock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

/**
 * Formulario de pago del ADAPTADOR DE PRUEBAS.
 *
 * Decisión central: **los datos de la tarjeta no salen de este componente**.
 * Se quedan en el estado de React y se descartan al navegar. Lo único que viaja
 * al servidor es `{orderId, paymentId, outcome}`.
 *
 * Por que así y no mandandolos:
 *  - La demo se ve y se siente como un checkout real, que es lo que se quiere
 *    enseñar, sin que exista en ningún sitio un número de tarjeta que guardar,
 *    cifrar, registrar en un log o filtrar.
 *  - Si mañana entra una pasarela de verdad, el dato sensible ira del navegador
 *    a la pasarela (tokenizado con su SDK) y este archivo se borra entero. No
 *    hay nada aquí que migrar ni limpiar.
 *
 * `autoComplete="off"` en los campos de tarjeta es deliberado: con `cc-number`
 * el navegador ofreceria autocompletar una tarjeta REAL guardada, y lo último
 * que queremos en una demostracion es que alguien meta la suya sin pensar.
 */
type Outcome = "paid" | "failed" | "pending";

function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** Marca aproximada por el primer digito. Solo decorativo. */
function brandOf(number: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 2) return null;
  if (digits.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^6/.test(digits)) return "Discover";
  return "Tarjeta";
}

export function SimulatorForm({
  orderId,
  paymentId,
  amountLabel,
}: {
  orderId: string;
  paymentId: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const brand = brandOf(number);

  function validate(): boolean {
    const next: Record<string, string> = {};
    const digits = number.replace(/\D/g, "");
    // Se acepta CUALQUIER número: solo se comprueba que tenga pinta de tarjeta,
    // para que el formulario se comporte, no para validar nada de verdad.
    if (digits.length < 13) next.number = "Escribe al menos 13 digitos";
    if (holder.trim().length < 3) next.holder = "Escribe el nombre de la tarjeta";
    if (!/^\d{2}\/\d{2}$/.test(expiry)) next.expiry = "Formato MM/AA";
    else if (Number(expiry.slice(0, 2)) < 1 || Number(expiry.slice(0, 2)) > 12) {
      next.expiry = "El mes va de 01 a 12";
    }
    if (!/^\d{3,4}$/.test(cvv)) next.cvv = "3 o 4 digitos";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function send(outcome: Outcome) {
    if (outcome === "paid" && !validate()) return;
    setBusy(outcome);
    try {
      // Fijate en lo que se manda: ni un digito de la tarjeta.
      const response = await fetch("/api/checkout/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, paymentId, outcome }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !body.ok) {
        toast.error("El webhook no se pudo procesar", { description: body.error });
        setBusy(null);
        return;
      }

      if (outcome === "paid") {
        toast.success("Pago confirmado", { description: "No se realizo ningún cargo." });
        router.push(`/checkout/${orderId}/resultado`);
      } else {
        toast.info(outcome === "failed" ? "Pago rechazado" : "Pago pendiente");
        router.push(`/checkout/${orderId}`);
      }
    } catch (error) {
      toast.error("No se pudo contactar al servidor", {
        description: error instanceof Error ? error.message : undefined,
      });
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send("paid");
        }}
        className="space-y-4"
        noValidate
      >
        <Field label="Número de tarjeta" htmlFor="card-number" error={errors.number} required>
          <div className="relative">
            <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              id="card-number"
              value={number}
              onChange={(e) => setNumber(formatCardNumber(e.target.value))}
              placeholder="4111 1111 1111 1111"
              inputMode="numeric"
              autoComplete="off"
              className="pl-10 pr-20 font-mono tracking-wider"
            />
            {brand ? (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wide text-muted">
                {brand}
              </span>
            ) : null}
          </div>
        </Field>

        <Field label="Nombre en la tarjeta" htmlFor="card-holder" error={errors.holder} required>
          <Input
            id="card-holder"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="CAMILA ROJAS"
            autoComplete="off"
            className="uppercase"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vencimiento" htmlFor="card-expiry" error={errors.expiry} required>
            <Input
              id="card-expiry"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              placeholder="12/29"
              inputMode="numeric"
              autoComplete="off"
              className="font-mono"
            />
          </Field>
          <Field label="CVV" htmlFor="card-cvv" error={errors.cvv} required>
            <Input
              id="card-cvv"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              inputMode="numeric"
              autoComplete="off"
              className="font-mono"
            />
          </Field>
        </div>

        <Button type="submit" full size="lg" disabled={busy !== null}>
          {busy === "paid" ? "Confirmando..." : `Pagar ${amountLabel}`}
        </Button>
      </form>

      <div className="space-y-2 rounded-xl bg-white/[0.04] p-4">
        <p className="flex items-start gap-2 text-xs text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-lime" />
          Puedes escribir cualquier número: <strong className="text-paper">no se cobra nada</strong> y
          los datos de la tarjeta <strong className="text-paper">no salen de tu navegador</strong>.
          Al servidor solo viaja el resultado que elijas.
        </p>
        <p className="flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-lime" />
          Aún así, el camino es el real: el servidor firma un webhook y lo entrega al mismo
          endpoint que usaría una pasarela, y es ese webhook —no esta pantalla— el que emite tu
          entrada y su código QR.
        </p>
      </div>

      <div className="border-t border-white/10 pt-4">
        <p className="mb-2 text-xs text-muted">¿Quieres ver que pasa si el pago no sale bien?</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void send("failed")}
          >
            {busy === "failed" ? "Enviando..." : "Simular pago rechazado"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => void send("pending")}
          >
            {busy === "pending" ? "Enviando..." : "Simular pago pendiente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
