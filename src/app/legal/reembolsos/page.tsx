import type { Metadata } from "next";

import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Política de reembolsos",
  description: "Cuándo corresponde una devolución en GETIN (borrador sujeto a revisión legal).",
};

export default function RefundsPage() {
  return (
    <LegalPage title="Política de reembolsos" updated="borrador inicial">
      <section>
        <h2>1. Regla general</h2>
        <p>
          Cada evento publica su propia política de cancelación, que se muestra antes de pagar y
          queda guardada en tu compra. Esa política es la que se aplica a tu caso concreto; esta
          página describe el marco general.
        </p>
      </section>

      <section>
        <h2>2. Cancelación del evento</h2>
        <p>
          Si el establecimiento cancela el evento, corresponde la devolución del{" "}
          <strong>importe total pagado</strong>, incluido el cargo por servicio. La devolución se
          realiza por el mismo medio de pago.
        </p>
      </section>

      <section>
        <h2>3. Cambio sustancial del evento</h2>
        <p>
          Si cambia la fecha, el local o el artista principal anunciado, puedes mantener tu entrada
          o solicitar la devolución del importe pagado dentro de los plazos que se comuniquen junto
          con el cambio.
        </p>
      </section>

      <section>
        <h2>4. Cancelación por tu parte</h2>
        <ul>
          <li>Depende de la política del evento. Muchos admiten devolución hasta cierto plazo previo.</li>
          <li>
            Pasado ese plazo, o si la política indica que la entrada no es reembolsable, no
            corresponde devolución.
          </li>
          <li>
            El adelanto de una mesa VIP normalmente <strong>no es reembolsable</strong>, porque el
            local bloquea esa mesa para ti. Siempre se indica antes de reservar.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Entradas ya utilizadas</h2>
        <p>
          Una entrada cuyo código QR ya fue validado en la puerta no es reembolsable. Tampoco lo es
          si no asististe al evento habiendo estado disponible el acceso, salvo que la política del
          evento diga lo contrario.
        </p>
      </section>

      <section>
        <h2>6. Si no te dejaron entrar</h2>
        <p>
          Si tenias una entrada pagada y válida y el establecimiento te nego el ingreso por haber
          alcanzado su aforo, corresponde la devolución del importe. Escribenos con el código de tu
          orden y revisaremos el caso junto con el local. El derecho de admisión ejercido de forma
          discriminatoria no es legitimo y puedes reclamarlo ante el Indecopi.
        </p>
      </section>

      <section>
        <h2>7. Como solicitarla</h2>
        <p>
          Escribe a{" "}
          <a href="mailto:soporte@getin.pe" className="text-lime hover:underline">
            soporte@getin.pe
          </a>{" "}
          con el código de la orden (formato GETIN-XXXXXX) y el motivo. GETIN revisa la solicitud
          con el establecimiento y comunica la decisión. Las devoluciones aprobadas se procesan por
          el proveedor de pagos y el plazo de acreditacion depende de tu banco.
        </p>
      </section>

      <section>
        <h2>8. Cargo por servicio</h2>
        <p>
          En cancelaciones imputables al establecimiento se devuelve también el cargo por servicio
          de GETIN. En cancelaciones voluntarias del comprador, la devolución del cargo por
          servicio depende de la política del evento.
        </p>
      </section>
    </LegalPage>
  );
}
