import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos del servicio de GETIN (borrador sujeto a revisión legal).",
};

export default function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones" updated="borrador inicial">
      <section>
        <h2>1. Qué es GETIN</h2>
        <p>
          GETIN es una plataforma que permite descubrir eventos nocturnos, comprar entradas,
          reservar mesas y apuntarse a listas de invitados en establecimientos de Lima, Perú.
          GETIN actúa como <strong>intermediario tecnológico</strong>: el evento, el servicio y
          el derecho de admisión corresponden al establecimiento organizador, no a GETIN.
        </p>
        {/* Decir quien responde es lo primero que exige la norma, y es
            justamente lo que todavia no se puede decir. Se dice eso. */}
        <p className="text-amber-200/80">
          <strong>Datos del proveedor pendientes.</strong> La razón social, el RUC y el domicilio
          fiscal se publicarán en cuanto la empresa esté constituida; hasta entonces figuran como
          pendientes aquí y en el Libro de Reclamaciones. No se indican datos provisionales:
          publicar un RUC que no existe es precisamente lo que la norma sanciona. Mientras tanto,
          estos términos son un <strong>borrador sujeto a revisión legal</strong> y no deben
          usarse en una operación comercial real.
        </p>
      </section>

      <section>
        <h2>2. Edad mínima</h2>
        <p>
          El uso de la plataforma está restringido a personas mayores de 18 años. Cada
          establecimiento puede exigir una edad mínima superior, que se indica en la página del
          evento. En la puerta se puede solicitar documento de identidad.
        </p>
      </section>

      <section>
        <h2>3. Cuenta de usuario</h2>
        <ul>
          <li>Los datos que registres deben ser veraces y estar actualizados.</li>
          <li>Eres responsable de la confidencialidad de tu contraseña.</li>
          <li>
            GETIN puede suspender cuentas con actividad fraudulenta, reventa no autorizada o uso
            abusivo de la plataforma.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Compra de entradas</h2>
        <ul>
          <li>
            Al seleccionar entradas se reservan temporalmente durante unos minutos. Si no completas
            el pago, vuelven a estar disponibles y no se realiza ningún cargo.
          </li>
          <li>
            El precio que ves en la ficha del evento es el que fija el establecimiento.{" "}
            <strong>No incluye el cargo por servicio de GETIN</strong>: ese cargo se suma
            aparte, se anuncia antes de elegir y se desglosa en el checkout, de modo que el
            total que pagas se ve antes de confirmar.
          </li>
          <li>
            En las mesas pagas aquí solo el adelanto más su cargo por servicio. El saldo de la
            mesa y el consumo mínimo se abonan en el local, y la ficha muestra el coste total de
            la noche antes de reservar.
          </li>
          <li>
            La compra se considera confirmada <strong>solo</strong> cuando el proveedor de pagos lo
            confirma. Recién entonces se emite la entrada y su código QR.
          </li>
          <li>Cada código QR es de un solo uso y personal. Duplicarlo invalida el ingreso.</li>
        </ul>
      </section>

      <section>
        <h2>5. Ingreso al establecimiento</h2>
        <p>
          Una entrada pagada da derecho a presentarse en el evento indicado, pero el ingreso
          efectivo depende del aforo autorizado del local, del horario de ingreso y del derecho de
          admisión del establecimiento, ejercido conforme a la ley y sin discriminación. GETIN no
          puede garantizar el acceso cuando el local alcanza su aforo o aplica sus reglas de
          ingreso.
        </p>
      </section>

      <section>
        <h2>6. Mesas VIP</h2>
        <ul>
          <li>La reserva de mesa requiere un adelanto que se paga en la plataforma.</li>
          <li>El saldo y el consumo mínimo, cuando corresponda, se abonan en el establecimiento.</li>
          <li>
            Las condiciones de cada mesa (capacidad, consumo mínimo, horario) se muestran antes de
            reservar y quedan registradas en tu reserva.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Listas de invitados</h2>
        <p>
          La inscripción en una lista no constituye una compra ni garantiza el ingreso. Esta sujeta
          al cupo de la lista, al horario límite y al criterio de admisión del establecimiento.
        </p>
      </section>

      <section>
        <h2>8. Cancelaciones y reembolsos</h2>
        <p>
          Cada evento publica su propia política de cancelación, que se muestra antes del pago y se
          guarda en tu compra. Si el establecimiento cancela el evento, corresponde la devolución
          del importe total. Ver la{" "}
          <a href="/legal/reembolsos" className="text-lime hover:underline">
            política de reembolsos
          </a>
          .
        </p>
      </section>

      <section>
        <h2>9. Responsabilidad</h2>
        <p>
          GETIN responde por el funcionamiento de la plataforma y por la correcta emision de las
          entradas pagadas. La prestacion del servicio en el local (seguridad, atención, consumo,
          programacion artistica) es responsabilidad del establecimiento.
        </p>
      </section>

      <section>
        <h2>10. Ley aplicable</h2>
        <p>
          Estos terminos se rigen por la legislacion peruana. Las controversias se someten a los
          jueces y tribunales de Lima, sin perjuicio de los derechos que el Código de Protección y
          Defensa del Consumidor reconoce al usuario, incluido el reclamo ante el Indecopi.
        </p>
      </section>

      <section>
        <h2>11. Contacto</h2>
        <p>
          Consultas y reclamos:{" "}
          <a href="mailto:soporte@getin.pe" className="text-lime hover:underline">
            soporte@getin.pe
          </a>
          . El{" "}
          <Link href="/legal/libro-de-reclamaciones" className="text-lime hover:underline">
            Libro de Reclamaciones virtual
          </Link>{" "}
          está habilitado: registra la reclamación con número correlativo, entrega constancia en
          pantalla y fija el plazo de respuesta.
        </p>
      </section>
    </LegalPage>
  );
}
