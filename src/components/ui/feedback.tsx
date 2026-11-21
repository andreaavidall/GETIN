import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** Esqueleto de carga. Mismo tamaño que el contenido real para evitar saltos. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function EventCardSkeleton() {
  return (
    <div className="surface overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between pt-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

export function EventGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("size-4 animate-spin", className)} aria-label="Cargando" role="status" />
  );
}

/** Estado vacio: siempre dice que paso y que hacer a continuacion. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-white/5">
        <Icon className="size-5 text-muted" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

/** Error recuperable, con el detalle visible (no un "algo salio mal" vacio). */
export function ErrorState({
  title = "No pudimos cargar esta seccion",
  detail,
  action,
}: {
  title?: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-6 py-10 text-center">
      <AlertTriangle className="size-6 text-red-400" />
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {detail ? <p className="max-w-md text-sm text-muted">{detail}</p> : null}
      {action}
    </div>
  );
}

/** Aviso de contenido ficticio. Se usa en cada pantalla del modo demo. */
export function DemoNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
      <p className="text-sm text-amber-100/90">
        <strong className="font-semibold">Modo demostracion.</strong> Las discotecas, eventos y
        precios de esta pantalla son ficticios y no estan a la venta. Para operar con datos reales
        hay que configurar Supabase y un proveedor de pagos.
      </p>
    </div>
  );
}
