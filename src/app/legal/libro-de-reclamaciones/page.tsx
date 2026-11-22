import { BookOpen, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones",
  description:
    "Libro de Reclamaciones virtual de GETIN, conforme al Codigo de Proteccion y Defensa del Consumidor.",
};

/**
 * Libro de Reclamaciones virtual.
 *
 * En Peru es OBLIGATORIO para quien vende por internet (Codigo de Proteccion y
 * Defensa del Consumidor, Ley 29571, y su reglamento). Tiene requisitos
 * formales: formulario con datos concretos, correlativo, acuse inmediato al
 * consumidor y respuesta en plazo.
 *
 * Esta pagina explica el canal provisional por correo y deja claro que el
 * formulario formal falta. No se finge que el libro este operativo: hacerlo
 * seria precisamente el incumplimiento que la norma castiga.
 */
export default function ComplaintsBookPage() {
  return (
    <LegalPage title="Libro de Reclamaciones" updated="borrador inicial">
      <div className="flex gap-3 rounded-xl border border-white/10 bg-surface p-5">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-lime" />
        <div>
          <h2 className="font-display text-base font-semibold text-paper">
            Pendiente de habilitar antes del lanzamiento comercial
          </h2>
          <p className="mt-1 text-sm text-muted">
            El formulario formal todavia no esta implementado. Mientras tanto, atendemos quejas y
            reclamos por correo, y los registramos con el mismo detalle. Antes de vender al
            publico hay que publicar aqui el formulario que exige la norma.
          </p>
        </div>
      </div>

      <section>
        <h2>Como presentar una queja o un reclamo ahora</h2>
        <p>
          Escribe a{" "}
          <a href="mailto:reclamos@getin.pe" className="text-lime hover:underline">
            reclamos@getin.pe
          </a>{" "}
          con esta informacion:
        </p>
        <ul>
          <li>Nombre completo, documento de identidad, telefono y correo.</li>
          <li>Codigo de la orden (formato GETIN-XXXXXX), si tu caso es por una compra.</li>
          <li>Si es un <strong>reclamo</strong> (disconformidad con el servicio o el producto) o
            una <strong>queja</strong> (malestar con la atencion recibida).</li>
          <li>Descripcion de lo ocurrido y que solucion esperas.</li>
        </ul>
        <p>
          Te respondemos con un numero de registro y atendemos el caso dentro del plazo legal de
          quince (15) dias habiles, prorrogable cuando la naturaleza del reclamo lo justifique.
        </p>
      </section>

      <section>
        <h2>Que debe tener la version definitiva</h2>
        <p>
          Lo dejo anotado para quien implemente esta pagina, porque la norma es concreta:
        </p>
        <ul>
          <li>Formulario en linea con numeracion correlativa automatica.</li>
          <li>
            Datos del consumidor, del bien o servicio contratado, monto reclamado, detalle y
            pedido.
          </li>
          <li>Distincion explicita entre queja y reclamo.</li>
          <li>Copia del registro enviada al consumidor de forma inmediata y automatica.</li>
          <li>Conservacion de los registros por el plazo que exige el reglamento.</li>
          <li>
            Aviso visible del Libro de Reclamaciones en la plataforma, enlazado desde el pie de
            pagina.
          </li>
        </ul>
      </section>

      <section>
        <h2>Si no quedas conforme</h2>
        <p>
          Puedes acudir al Indecopi. El reclamo ante GETIN no te impide ejercer tus derechos ante
          la autoridad de consumo ni interrumpe los plazos que la ley te concede.
        </p>
        <p>
          Recuerda ademas que GETIN intermedia la venta: el evento lo presta el establecimiento.
          Segun el caso, el reclamo puede corresponder al local, y te lo indicaremos derivandolo.
        </p>
      </section>

      <section>
        <h2>Otros canales</h2>
        <p className="flex items-center gap-2">
          <Mail className="size-4 text-lime" />
          Soporte general:{" "}
          <a href="mailto:soporte@getin.pe" className="text-lime hover:underline">
            soporte@getin.pe
          </a>
        </p>
        <p>
          Ver tambien la{" "}
          <Link href="/legal/reembolsos" className="text-lime hover:underline">
            politica de reembolsos
          </Link>{" "}
          y los{" "}
          <Link href="/legal/terminos" className="text-lime hover:underline">
            terminos del servicio
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  );
}
