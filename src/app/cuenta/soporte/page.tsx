import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SupportPanel } from "@/components/account/support-panel";
import { DemoNotice } from "@/components/ui/feedback";
import { requireSession } from "@/lib/auth/guards";
import { isDemoMode } from "@/lib/data/catalog";
import { listMyOrders } from "@/lib/data/orders";
import { listMySupportTickets } from "@/lib/data/support";

export const metadata: Metadata = { title: "Soporte", robots: { index: false } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ orden?: string }>;

/**
 * Soporte con estado.
 *
 * Antes era un enlace de correo. Ahora cada problema queda registrado con su
 * motivo, su compra y su estado, y la conversación se lee aquí.
 */
export default async function SupportPage({ searchParams }: { searchParams: SearchParams }) {
  const { orden } = await searchParams;

  if (isDemoMode()) {
    return (
      <div className="space-y-4">
        <DemoNotice />
        <section className="surface p-5">
          <h2 className="font-display text-lg font-semibold">Soporte</h2>
          <p className="mt-3 text-sm text-muted">
            En modo demostración no hay compras reales sobre las que reclamar. Con Supabase
            configurado, cada solicitud queda registrada con su estado.
          </p>
        </section>
      </div>
    );
  }

  await requireSession("/cuenta/soporte");
  const [tickets, orders] = await Promise.all([listMySupportTickets(), listMyOrders()]);

  const ordenActual = orden ? orders.find((o) => o.code === orden) : undefined;

  return (
    <div className="space-y-6">
      <SupportPanel
        tickets={tickets}
        orders={orders.map((o) => ({ id: o.id, code: o.code }))}
        defaultOrderId={ordenActual?.id}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-display text-base font-semibold">Reembolsos</h2>
          <p className="mt-3 text-sm text-muted">
            Cada evento tiene su propia política de cancelación, que se muestra antes de pagar y
            queda guardada en tu compra. Si el evento se cancela, se devuelve el importe completo.
          </p>
          <Link
            href="/legal/reembolsos"
            className="mt-4 inline-block text-sm text-lime hover:underline"
          >
            Leer la política de reembolsos →
          </Link>
        </section>

        <section className="surface p-5">
          <h2 className="font-display text-base font-semibold">Otra vía</h2>
          <p className="mt-3 text-sm text-muted">
            Si prefieres el correo, escríbenos con el código de tu orden. Respondemos en horario
            de oficina, de lunes a viernes.
          </p>
          <a
            href="mailto:soporte@getin.pe"
            className="mt-4 inline-flex items-center gap-2 text-sm text-lime hover:underline"
          >
            <Mail className="size-4" />
            soporte@getin.pe
          </a>
          <p className="mt-4 text-xs text-muted">
            Para una reclamación formal existe el{" "}
            <Link href="/legal/libro-de-reclamaciones" className="text-lime hover:underline">
              Libro de Reclamaciones
            </Link>
            , con número correlativo y plazo de respuesta.
          </p>
        </section>
      </div>
    </div>
  );
}
