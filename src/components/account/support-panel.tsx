"use client";

import { LifeBuoy, MessageSquarePlus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { openSupportTicketAction, replySupportAction, SUPPORT_REASONS } from "@/lib/actions/support";
import type { SupportTicketView } from "@/lib/data/support";
import { formatEventDate } from "@/lib/utils";

const ESTADO_TONO: Record<SupportTicketView["status"], "success" | "warning" | "outline"> = {
  open: "warning",
  pending_user: "warning",
  resolved: "success",
  closed: "outline",
};

const ESTADO_TEXTO: Record<SupportTicketView["status"], string> = {
  open: "Abierta",
  pending_user: "Esperando tu respuesta",
  resolved: "Resuelta",
  closed: "Cerrada",
};

/**
 * Soporte con estado e hilo.
 *
 * Antes esto era un enlace de correo: quien escribía no volvía a saber nada
 * hasta que le contestaban. Aquí la solicitud queda registrada, con su motivo
 * y su estado, y la conversación se lee entera en un sitio.
 */
export function SupportPanel({
  tickets,
  orders,
  defaultOrderId,
}: {
  tickets: SupportTicketView[];
  orders: { id: string; code: string }[];
  defaultOrderId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(tickets.length === 0 || Boolean(defaultOrderId));

  function crear(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await openSupportTicketAction({
        orderId: String(data.get("orderId") ?? "") || undefined,
        reason: String(data.get("reason") ?? "otro"),
        body: String(data.get("body") ?? ""),
      });
      if (!result.ok) {
        toast.error("No se pudo registrar", { description: result.error });
        return;
      }
      form.reset();
      setAbierto(false);
      toast.success("Solicitud registrada", {
        description: "Te respondemos aquí mismo; verás el estado en esta página.",
      });
      router.refresh();
    });
  }

  function responder(ticketId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await replySupportAction({
        ticketId,
        body: String(data.get("body") ?? ""),
      });
      if (!result.ok) {
        toast.error("No se pudo enviar", { description: result.error });
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <LifeBuoy className="size-5 text-lime" />
              Tengo un problema
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted">
              Cuéntanos qué pasó y con qué compra. Queda registrado con su estado: no hace falta
              que reenvíes correos para saber en qué va.
            </p>
          </div>
          {!abierto ? (
            <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
              <MessageSquarePlus className="size-4" />
              Nueva solicitud
            </Button>
          ) : null}
        </div>

        {abierto ? (
          <form onSubmit={crear} className="mt-4 space-y-3 border-t border-white/10 pt-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Qué ocurrió" htmlFor="sp-reason" required>
                <Select id="sp-reason" name="reason" defaultValue="otro">
                  {Object.entries(SUPPORT_REASONS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Compra relacionada" htmlFor="sp-order" hint="Opcional">
                <Select id="sp-order" name="orderId" defaultValue={defaultOrderId ?? ""}>
                  <option value="">Ninguna en concreto</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Cuéntanos" htmlFor="sp-body" required>
              <Textarea id="sp-body" name="body" rows={4} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Enviando..." : "Enviar solicitud"}
              </Button>
              {tickets.length > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>

      {tickets.map((ticket) => (
        <article key={ticket.id} className="surface overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 p-5">
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold">{ticket.subject}</h3>
              <p className="mt-0.5 text-xs text-muted">
                {formatEventDate(ticket.createdAt, { withTime: false })}
                {ticket.orderCode ? (
                  <>
                    {" · "}
                    <span className="font-mono text-lime">{ticket.orderCode}</span>
                  </>
                ) : null}
              </p>
            </div>
            <Badge variant={ESTADO_TONO[ticket.status]}>{ESTADO_TEXTO[ticket.status]}</Badge>
          </header>

          <ul className="divide-y divide-white/5">
            {ticket.messages.map((m) => (
              <li key={m.id} className="p-5">
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  {m.isStaff ? "GETIN" : "Tú"} ·{" "}
                  {formatEventDate(m.createdAt, { withTime: false })}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
              </li>
            ))}
          </ul>

          {ticket.status !== "closed" ? (
            <form
              onSubmit={(e) => responder(ticket.id, e)}
              className="space-y-2 border-t border-white/10 p-5"
              noValidate
            >
              <Field label="Responder" htmlFor={`reply-${ticket.id}`}>
                <Textarea id={`reply-${ticket.id}`} name="body" rows={2} />
              </Field>
              <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                <Send className="size-4" />
                Enviar
              </Button>
            </form>
          ) : null}
        </article>
      ))}
    </div>
  );
}
