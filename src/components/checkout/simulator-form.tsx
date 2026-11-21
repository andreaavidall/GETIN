"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const OUTCOMES = [
  {
    value: "paid",
    label: "Pago aprobado",
    help: "Emite las entradas y sus codigos QR, igual que un pago real confirmado.",
    variant: "primary" as const,
  },
  {
    value: "failed",
    label: "Pago rechazado",
    help: "La orden vuelve a «pendiente» y puedes reintentar mientras dure la reserva.",
    variant: "outline" as const,
  },
  {
    value: "pending",
    label: "Pago pendiente",
    help: "Simula un medio de pago diferido: no se emite nada hasta que se confirme.",
    variant: "outline" as const,
  },
];

export function SimulatorForm({ orderId, paymentId }: { orderId: string; paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function send(outcome: string) {
    setBusy(outcome);
    try {
      // El secreto del webhook vive en el servidor: esta ruta firma y entrega.
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
        toast.success("Pago confirmado por el webhook");
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
    <div className="space-y-3">
      {OUTCOMES.map((outcome) => (
        <div key={outcome.value}>
          <Button
            full
            variant={outcome.variant}
            disabled={busy !== null}
            onClick={() => send(outcome.value)}
          >
            {busy === outcome.value ? "Enviando webhook..." : outcome.label}
          </Button>
          <p className="mt-1.5 text-[11px] text-muted">{outcome.help}</p>
        </div>
      ))}
    </div>
  );
}
