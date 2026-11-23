"use client";

import { Check, Copy, Send, UserCog, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import {
  cancelTicketTransferAction,
  createTicketTransferAction,
  setTicketHolderAction,
} from "@/lib/actions/tickets";

/**
 * Asignar la entrada a quien va a usarla y, si hace falta, pasársela.
 *
 * Poner el nombre y traspasarla son cosas distintas: lo primero es para la
 * puerta, lo segundo mueve la entrada a otra cuenta y anula el QR anterior.
 * Se dicen por separado para que nadie crea que escribir un nombre ya se la
 * envió a su amigo.
 */
export function TicketHolder({
  ticketId,
  holderName,
  pendingTransfer,
}: {
  ticketId: string;
  holderName: string | null;
  pendingTransfer: { id: string; toEmail: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<"cerrado" | "nombre" | "traspaso">("cerrado");
  const [enlace, setEnlace] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function guardarNombre(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await setTicketHolderAction({
        ticketId,
        holderName: String(data.get("holderName") ?? ""),
      });
      if (!result.ok) {
        toast.error("No se pudo guardar", { description: result.error });
        return;
      }
      toast.success("Entrada asignada");
      setModo("cerrado");
      router.refresh();
    });
  }

  function crearTraspaso(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createTicketTransferAction({
        ticketId,
        toEmail: String(data.get("toEmail") ?? ""),
      });
      if (!result.ok) {
        toast.error("No se pudo preparar el traspaso", { description: result.error });
        return;
      }
      setEnlace(`${window.location.origin}${result.url}`);
      router.refresh();
    });
  }

  function cancelar(id: string) {
    startTransition(async () => {
      const result = await cancelTicketTransferAction(id);
      if (!result.ok) {
        toast.error("No se pudo cancelar", { description: result.error });
        return;
      }
      setEnlace(null);
      toast.success("Traspaso cancelado");
      router.refresh();
    });
  }

  async function copiar() {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No pudimos copiar el enlace");
    }
  }

  if (pendingTransfer && !enlace) {
    return (
      <div className="space-y-2 border-t border-white/10 p-5 text-xs">
        <p className="text-amber-200/90">
          Traspaso pendiente a <strong>{pendingTransfer.toEmail}</strong>. Mientras no lo
          reclame, la entrada sigue siendo tuya y tu QR sigue valiendo.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => cancelar(pendingTransfer.id)}
          disabled={pending}
        >
          <X className="size-4" />
          Cancelar traspaso
        </Button>
      </div>
    );
  }

  if (enlace) {
    return (
      <div className="space-y-2 border-t border-white/10 p-5 text-xs">
        <p className="text-muted">
          Pásale este enlace a quien recibirá la entrada. Al abrirlo e iniciar sesión, la
          entrada pasa a su cuenta y <strong className="text-paper">tu QR deja de valer</strong>.
        </p>
        <p className="break-all rounded-lg bg-white/5 p-2 font-mono">{enlace}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={copiar}>
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiado ? "Copiado" : "Copiar enlace"}
          </Button>
          {pendingTransfer ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelar(pendingTransfer.id)}
              disabled={pending}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
        <p className="text-muted">Caduca en 7 días.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 p-5">
      {modo === "cerrado" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setModo("nombre")}>
            <UserCog className="size-4" />
            {holderName ? "Cambiar nombre" : "Poner nombre"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setModo("traspaso")}>
            <Send className="size-4" />
            Pasar a otra persona
          </Button>
        </div>
      ) : modo === "nombre" ? (
        <form onSubmit={guardarNombre} className="space-y-3" noValidate>
          <Field
            label="Nombre de quien entra con esta entrada"
            htmlFor={`holder-${ticketId}`}
            hint="Es el nombre que verá el personal de la puerta"
            required
          >
            <Input id={`holder-${ticketId}`} name="holderName" defaultValue={holderName ?? ""} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setModo("cerrado")}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={crearTraspaso} className="space-y-3" noValidate>
          <Field
            label="Correo de quien recibirá la entrada"
            htmlFor={`transfer-${ticketId}`}
            hint="Generamos un enlace: se lo pasas tú. Todavía no enviamos correos."
            required
          >
            <Input id={`transfer-${ticketId}`} name="toEmail" type="email" />
          </Field>
          <p className="text-[11px] text-muted">
            Al reclamarla, la entrada pasa a su cuenta y tu código QR queda anulado. Así la
            misma entrada no circula en dos teléfonos.
          </p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Preparando..." : "Generar enlace"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setModo("cerrado")}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
