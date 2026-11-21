import type { Metadata } from "next";

import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Terminos y condiciones",
  description: "Terminos del servicio de GETIN (borrador sujeto a revision legal).",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terminos y condiciones" updated="borrador inicial">
      <section>
        <h2>1. Que es GETIN</h2>
        <p>
          GETIN es una plataforma que permite descubrir eventos nocturnos, comprar entradas,
          reservar mesas y apuntarse a listas de invitados en establecimientos de Lima, Peru. GETIN
          actua como <strong>intermediario tecnologico</strong>: el evento, el servicio y el
          derecho de admision corresponden al establecimiento organizador, no a GETIN.
        </p>
      </section>

      <section>
        <h2>2. Edad minima</h2>
        <p>
          El uso de la plataforma esta restringido a personas mayores de 18 años. Cada
          establecimiento puede exigir una edad minima superior, que se indica en la pagina del
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
            el pago, vuelven a estar disponibles y no se realiza ningun cargo.
          </li>
          <li>
            El precio mostrado incluye el precio fijado por el establecimiento y el cargo por
            servicio de GETIN, que se desglosa en el checkout antes de pagar.
          </li>
          <li>
            La compra se considera confirmada <strong>solo</strong> cuando el proveedor de pagos lo
            confirma. Recien entonces se emite la entrada y su codigo QR.
          </li>
          <li>Cada codigo QR es de un solo uso y personal. Su duplicacion invalida el ingreso.</li>
        </ul>
      </section>

      <section>
        <h2>5. Ingreso al establecimiento</h2>
        <p>
          Una entrada pagada da derecho a presentarse en el evento indicado, pero el ingreso
          efectivo depende del aforo autorizado del local, del horario de ingreso y del derecho de
          admision del establecimiento, ejercido conforme a la ley y sin discriminacion. GETIN no
          puede garantizar el acceso cuando el local alcanza su aforo o aplica sus reglas de
          ingreso.
        </p>
      </section>

      <section>
        <h2>6. Mesas VIP</h2>
        <ul>
          <li>La reserva de mesa requiere un adelanto que se paga en la plataforma.</li>
          <li>El saldo y el consumo minimo, cuando corresponda, se abonan en el establecimiento.</li>
          <li>
            Las condiciones de cada mesa (capacidad, consumo minimo, horario) se muestran antes de
            reservar y quedan registradas en tu reserva.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Listas de invitados</h2>
        <p>
          La inscripcion en una lista no constituye una compra ni garantiza el ingreso. Esta sujeta
          al cupo de la lista, al horario limite y al criterio de admision del establecimiento.
        </p>
      </section>

      <section>
        <h2>8. Cancelaciones y reembolsos</h2>
        <p>
          Cada evento publica su propia politica de cancelacion, que se muestra antes del pago y se
          guarda en tu compra. Si el establecimiento cancela el evento, corresponde la devolucion
          del importe total. Ver la{" "}
          <a href="/legal/reembolsos" className="text-lime hover:underline">
            politica de reembolsos
          </a>
          .
        </p>
      </section>

      <section>
        <h2>9. Responsabilidad</h2>
        <p>
          GETIN responde por el funcionamiento de la plataforma y por la correcta emision de las
          entradas pagadas. La prestacion del servicio en el local (seguridad, atencion, consumo,
          programacion artistica) es responsabilidad del establecimiento.
        </p>
      </section>

      <section>
        <h2>10. Ley aplicable</h2>
        <p>
          Estos terminos se rigen por la legislacion peruana. Las controversias se someten a los
          jueces y tribunales de Lima, sin perjuicio de los derechos que el Codigo de Proteccion y
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
          . El Libro de Reclamaciones virtual debe habilitarse antes del lanzamiento comercial.
        </p>
      </section>
    </LegalPage>
  );
}
