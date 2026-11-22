"use client";

import { BellRing, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleWaitlistAction } from "@/lib/actions/waitlist";
import { cn } from "@/lib/utils";

/**
 * "Avísame si se libera".
 *
 * El texto no promete una reserva en ningún momento: cuando llegue el aviso
 * habrá que comprar como todos. Es la diferencia entre un aviso útil y una
 * promesa que no se puede cumplir.
 */
export function WaitlistButton({
  eventId,
  eventSlug,
  ticketTypeId,
  venueTableId,
  initial,
  isAuthenticated,
  label,
}: {
  eventId: string;
  eventSlug: string;
  ticketTypeId?: string;
  venueTableId?: string;
  initial: boolean;
  isAuthenticated: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!isAuthenticated) {
      router.push(`/login?siguiente=${encodeURIComponent(`/eventos/${eventSlug}`)}`);
      return;
    }

    startTransition(async () => {
      const result = await toggleWaitlistAction({ eventId, ticketTypeId, venueTableId });
      if (!result.ok) {
        toast.error("No se pudo apuntar", { description: result.error });
        return;
      }
      setWaiting(result.waiting);
      toast.success(
        result.waiting ? "Te avisaremos si se libera" : "Ya no te avisaremos",
        result.waiting
          ? { description: "El aviso no reserva nada: habrá que comprar cuando llegue." }
          : undefined,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={waiting}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition",
          waiting
            ? "border-lime/40 bg-lime/10 text-lime"
            : "border-white/15 bg-white/5 text-paper hover:bg-white/10",
          pending && "opacity-60",
        )}
      >
        {waiting ? <Check className="size-4" /> : <BellRing className="size-4" />}
        {waiting ? "Te avisaremos" : (label ?? "Avísame si se libera")}
      </button>
      {waiting ? (
        <p className="text-[11px] text-muted">
          No es una reserva: si se libera, te avisamos y compras como todos.
        </p>
      ) : null}
    </div>
  );
}
