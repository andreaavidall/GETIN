import type { Metadata } from "next";

import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Como trata GETIN los datos personales conforme a la Ley 29733 (borrador sujeto a revisión legal).",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updated="borrador inicial">
      <section>
        <h2>1. Responsable del tratamiento</h2>
        <p>
          GETIN (datos de la entidad titular pendientes de completar antes del lanzamiento) trata
          tus datos personales conforme a la Ley 29733 de Protección de Datos Personales y su
          reglamento.
        </p>
      </section>

      <section>
        <h2>2. Datos que recogemos</h2>
        <ul>
          <li>
            <strong>De tu cuenta:</strong> nombre, correo electrónico, teléfono (opcional) y fecha
            de nacimiento, para verificar la mayoria de edad.
          </li>
          <li>
            <strong>De tus compras:</strong> eventos, entradas, mesas, importes y estado del pago.
          </li>
          <li>
            <strong>Del pago:</strong> la marca de la tarjeta y sus cuatro ultimos digitos. GETIN{" "}
            <strong>no almacena</strong> el número completo de la tarjeta ni el código de
            seguridad: esos datos viajan directamente al proveedor de pagos.
          </li>
          <li>
            <strong>Del ingreso:</strong> fecha, hora y resultado de la validación de tu código QR.
          </li>
          <li>
            <strong>Tecnicos:</strong> dirección IP y navegador en operaciones sensibles, para
            seguridad y auditoria.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Para que los usamos</h2>
        <ul>
          <li>Gestionar tu cuenta y tus compras.</li>
          <li>Emitir y validar tus entradas y reservas.</li>
          <li>Comunicarte confirmaciones, cambios o cancelaciones del evento.</li>
          <li>Prevenir fraude, reventa no autorizada y abuso de la plataforma.</li>
          <li>Cumplir obligaciones contables y legales.</li>
        </ul>
        <p>
          Las comunicaciones comerciales se envian solo si das tu consentimiento, y puedes
          retirarlo en cualquier momento.
        </p>
      </section>

      <section>
        <h2>4. Con quien los compartimos</h2>
        <ul>
          <li>
            <strong>El establecimiento del evento:</strong> recibe los datos necesarios para el
            control de acceso de su propio evento (nombre del titular, tipo de entrada, estado).
            No accede a tus compras en otros locales.
          </li>
          <li>
            <strong>El proveedor de pagos:</strong> procesa el cobro y es responsable de los datos
            de tu tarjeta.
          </li>
          <li>
            <strong>Proveedores de infraestructura:</strong> alojamiento y base de datos. Pueden
            implicar transferencia internacional de datos, con las garantias que exige la ley.
          </li>
        </ul>
        <p>No vendemos tus datos personales.</p>
      </section>

      <section>
        <h2>5. Tu código QR</h2>
        <p>
          El código QR de tu entrada <strong>no contiene datos personales</strong>: es un
          identificador aleatorio firmado criptograficamente que solo sirve para validar el
          ingreso. Si alguien lo fotografia no obtiene tu nombre, tu correo ni tu documento.
        </p>
      </section>

      <section>
        <h2>6. Cuanto tiempo los conservamos</h2>
        <p>
          Los datos de tu cuenta se conservan mientras la mantengas activa. Los registros de
          compras y pagos se conservan por el plazo que exigen las obligaciones contables y
          tributarias peruanas, y los registros de auditoria por el tiempo necesario para atender
          reclamos y disputas.
        </p>
      </section>

      <section>
        <h2>7. Tus derechos</h2>
        <p>
          Puedes ejercer tus derechos de acceso, rectificacion, cancelación y oposicion (ARCO), así
          como solicitar la portabilidad o la eliminacion de tu cuenta, escribiendo a{" "}
          <a href="mailto:privacidad@getin.pe" className="text-lime hover:underline">
            privacidad@getin.pe
          </a>
          . Responderemos en los plazos legales. También puedes presentar un reclamo ante la
          Autoridad Nacional de Protección de Datos Personales.
        </p>
      </section>

      <section>
        <h2>8. Seguridad</h2>
        <p>
          Aplicamos control de acceso por roles, cifrado en transito, segregacion de datos por
          establecimiento y registro de auditoria de las operaciones sensibles. Ningún sistema es
          infalible: si detectamos un incidente que afecte tus datos, te lo comunicaremos.
        </p>
      </section>
    </LegalPage>
  );
}
