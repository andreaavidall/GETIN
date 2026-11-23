"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { claimTicketTransferAction } from "@/lib/actions/tickets";

/**
 * Botón de reclamar.
 *
 * Es una acción irreversible para quien la pasó (su QR queda anulado), así que
 * se dice antes y se confirma con un clic explícito, nunca al cargar la página.
 */
export function ClaimTransfer({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reclamar() {
    setError(null);
    startTransition(async () => {
      const result = await claimTicketTransferAction(token);
      if (!result.ok) {
        setError(result.error);
        toast.error("No se pudo recibir la entrada", { description: result.error });
        return;
      }
      toast.success("La entrada ya es tuya");
      router.push("/cuenta/entradas");
    });
  }

  return (
    <div className="surface space-y-3 p-5">
      <Button full onClick={reclamar} disabled={pending}>
        {pending ? "Recibiendo..." : "Recibir la entrada"}
      </Button>
      {error ? (
        <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <p className="text-[11px] text-muted">
        El enlace caduca a los 7 días y solo sirve una vez.
      </p>
    </div>
  );
}
