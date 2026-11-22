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
          Escríbenos por correo con el código de tu orden y respondemos en horario de oficina,
          de lunes a viernes.
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
          Cada evento tiene su propia política de cancelación, que se muestra antes de pagar y queda
          guardada en tu compra. Si el evento se cancela, se devuelve el importe completo.
        </p>
        <p className="mt-3 text-sm text-muted">
          Para pedir una devolución indica el código de la orden y el motivo. GETIN revisa la
          solicitud junto con el local; la devolución se procesa por el mismo medio de pago.
        </p>
        <Link
          href="/legal/reembolsos"
          className="mt-4 inline-block text-sm text-lime hover:underline"
        >
          Leer la política de reembolsos →
        </Link>
      </section>
    </div>
  );
}
