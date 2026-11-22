"use client";

import { BellRing, CalendarPlus, Check, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  setNotifyPreferenceAction,
} from "@/lib/actions/notifications";
import type { NotificationView } from "@/lib/data/notifications";
import { cn, relativeDay } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  evento_nuevo: CalendarPlus,
  disponible: Ticket,
  generic: BellRing,
};

export function NotificationList({
  notifications,
  notifyNewEvents,
}: {
  notifications: NotificationView[];
  notifyNewEvents: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const sinLeer = notifications.filter((n) => n.readAt === null).length;

  function marcarTodos() {
    startTransition(async () => {
      const r = await markAllNotificationsReadAction();
      if (!r.ok) {
        toast.error("No se pudo marcar", { description: r.error });
        return;
      }
      router.refresh();
    });
  }

  function marcar(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  function cambiarPreferencia(valor: boolean) {
    startTransition(async () => {
      const r = await setNotifyPreferenceAction(valor);
      if (!r.ok) {
        toast.error("No se pudo guardar", { description: r.error });
        return;
      }
      toast.success(valor ? "Te avisaremos" : "No te avisaremos");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="max-w-md">
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={notifyNewEvents}
              onChange={(e) => cambiarPreferencia(e.target.checked)}
              disabled={pending}
              className="mt-0.5 size-4 accent-lime"
            />
            <span>
              Avisarme cuando una discoteca que guardé publique un evento
              <span className="mt-1 block text-xs text-muted">
                Los avisos aparecen aquí, dentro de GETIN. Todavía no se envían por correo:
                no hay proveedor de envío configurado, y no vamos a decir que te llegó un
                correo que nadie mandó.
              </span>
            </span>
          </label>
        </div>
        {sinLeer > 0 ? (
          <Button variant="secondary" size="sm" onClick={marcarTodos} disabled={pending}>
            <Check className="size-4" />
            Marcar todo como leído
          </Button>
        ) : null}
      </div>

      <ul className="space-y-3">
        {notifications.map((n) => {
          const Icon = ICONS[n.kind] ?? BellRing;
          const sinLeerEste = n.readAt === null;
          const contenido = (
            <div className="flex gap-3">
              <div
                className={cn(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                  sinLeerEste ? "bg-lime/15 text-lime" : "bg-white/5 text-muted",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", sinLeerEste ? "font-semibold" : "text-muted")}>
                  {n.title}
                </p>
                {n.body ? <p className="mt-0.5 truncate text-sm text-muted">{n.body}</p> : null}
                <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">
                  {relativeDay(n.createdAt)}
                </p>
              </div>
              {sinLeerEste ? (
                <span className="mt-2 size-2 shrink-0 rounded-full bg-lime" aria-label="Sin leer" />
              ) : null}
            </div>
          );

          return (
            <li key={n.id} className="surface p-4">
              {n.href ? (
                <Link href={n.href} onClick={() => sinLeerEste && marcar(n.id)} className="block">
                  {contenido}
                </Link>
              ) : (
                contenido
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
