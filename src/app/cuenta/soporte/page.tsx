import { LifeBuoy, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Soporte", robots: { index: false } };

type SearchParams = Promise<{ orden?: string }>;

export default async function SupportPage({ searchParams }: { searchParams: SearchParams }) {
  const { orden } = await searchParams;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="surface p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <LifeBuoy className="size-5 text-lime" />
          Necesito ayuda
        </h2>

        {orden ? (
          <p className="mt-3 rounded-xl bg-white/[0.04] p-3 text-sm">
            Orden referida: <span className="font-mono text-lime">{orden}</span>
          </p>
        ) : null}

        <p className="mt-3 text-sm text-muted">
          El formulario de tickets dentro de la plataforma esta previsto para la fase 2 (la tabla{" "}
          <code className="rounded bg-white/10 px-1 text-xs">support_tickets</code> ya existe en la
          base de datos). Mientras tanto escribenos por correo y respondemos en horario de oficina.
        </p>

        <a
          href={`mailto:soporte@getin.pe${orden ? `?subject=Consulta%20sobre%20la%20orden%20${orden}` : ""}`}
          className="mt-4 inline-flex items-center gap-2 text-sm text-lime hover:underline"
        >
          <Mail className="size-4" />
          soporte@getin.pe
        </a>
      </section>

      <section className="surface p-5">
        <h2 className="font-display text-lg font-semibold">Reembolsos</h2>
        <p className="mt-3 text-sm text-muted">
          Cada evento tiene su propia politica de cancelacion, que se muestra antes de pagar y queda
          guardada en tu compra. Si el evento se cancela, se devuelve el importe completo.
        </p>
        <p className="mt-3 text-sm text-muted">
          Para pedir una devolucion indica el codigo de la orden y el motivo. GETIN revisa la
          solicitud junto con el local; la devolucion se procesa por el mismo medio de pago.
        </p>
        <Link
          href="/legal/reembolsos"
          className="mt-4 inline-block text-sm text-lime hover:underline"
        >
          Leer la politica de reembolsos →
        </Link>
      </section>
    </div>
  );
}
