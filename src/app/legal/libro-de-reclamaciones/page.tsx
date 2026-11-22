import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ComplaintForm } from "@/components/legal/complaint-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones",
  description:
    "Libro de Reclamaciones virtual de GETIN, conforme al Código de Protección y Defensa del Consumidor.",
};

export const dynamic = "force-dynamic";

/**
 * Libro de Reclamaciones virtual.
 *
 * Obligatorio en Perú para quien vende por internet. Antes esta página era un
 * instructivo que mandaba a escribir un correo; ahora registra de verdad, con
 * correlativo y constancia inmediata, que es lo que la norma exige.
 */
export default async function ComplaintsBookPage() {
  const session = await getSession();

  return (
    <div className="container max-w-3xl py-10">
      <div className="flex items-start gap-3">
        <BookOpen className="mt-1 size-6 shrink-0 text-lime" />
        <div>
          <h1 className="text-display text-3xl sm:text-4xl">Libro de Reclamaciones</h1>
          <p className="mt-2 text-sm text-muted">
            Conforme al Código de Protección y Defensa del Consumidor (Ley 29571) y su
            reglamento. Puedes presentar una reclamación tengas o no cuenta en GETIN.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="surface p-4">
          <h2 className="text-sm font-semibold">Reclamo</h2>
          <p className="mt-1 text-xs text-muted">
            Disconformidad con el servicio o el producto: no recibiste tu entrada, te cobraron de
            más, el evento cambió sin aviso.
          </p>
        </div>
        <div className="surface p-4">
          <h2 className="text-sm font-semibold">Queja</h2>
          <p className="mt-1 text-xs text-muted">
            Malestar con la atención recibida: trato inadecuado, demoras en la respuesta,
            información confusa.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ComplaintForm
          defaultEmail={session?.user.email}
          defaultName={session?.user.fullName ?? undefined}
        />
      </div>

      <section className="surface mt-8 p-5">
        <h2 className="font-display text-base font-semibold">Datos del proveedor</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Nombre comercial</dt>
            <dd>GETIN</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Razón social</dt>
            <dd className="text-right text-amber-300">Pendiente de constitución</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">RUC</dt>
            <dd className="text-right text-amber-300">Pendiente de constitución</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Domicilio fiscal</dt>
            <dd className="text-right text-amber-300">Pendiente de constitución</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Correo de reclamaciones</dt>
            <dd>
              <a href="mailto:reclamos@getin.pe" className="text-lime hover:underline">
                reclamos@getin.pe
              </a>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-amber-200/80">
          Los datos marcados como pendientes se publicarán en cuanto la empresa esté constituida.
          No se indican datos provisionales ni aproximados: publicar una razón social o un RUC que
          no existen sería precisamente lo que la norma sanciona.
        </p>
      </section>

      <section className="mt-6 space-y-4 text-sm leading-relaxed text-white/80">
        <h2 className="font-display text-lg font-semibold text-paper">Qué ocurre después</h2>
        <ul className="space-y-2 [&>li]:ml-5 [&>li]:list-disc">
          <li>
            Al registrar tu reclamación recibes un <strong>número correlativo</strong> en
            pantalla. Ese número acredita que la presentaste: guárdalo o imprímelo.
          </li>
          <li>
            Enviamos una copia al correo que indiques. Si no te llega, la constancia en pantalla
            tiene la misma validez.
          </li>
          <li>
            GETIN responde en un plazo máximo de <strong>quince (15) días hábiles</strong> desde
            el registro. Ese plazo no se prorroga.
          </li>
          <li>
            GETIN intermedia la venta: el evento lo presta el establecimiento. Según el caso,
            trasladaremos tu reclamación al local y te lo indicaremos en la respuesta.
          </li>
          <li>
            Presentar una reclamación aquí <strong>no impide</strong> acudir al Indecopi ni
            interrumpe los plazos que la ley te concede.
          </li>
        </ul>

        <p className="text-xs text-muted">
          Ver también la{" "}
          <Link href="/legal/reembolsos" className="text-lime hover:underline">
            política de reembolsos
          </Link>{" "}
          y los{" "}
          <Link href="/legal/terminos" className="text-lime hover:underline">
            términos del servicio
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
