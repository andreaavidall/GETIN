import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { VenueApplicationForm } from "@/components/club/venue-application-form";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Publicar mi local",
  description:
    "Registra tu discoteca en GETIN: vende entradas, administra mesas VIP y controla el ingreso con códigos QR.",
};

/**
 * Página publica.
 *
 * Es la puerta de entrada comercial: un local tiene que poder leerla sin tener
 * cuenta. Antes exigia sesión para toda la página, así que en el despliegue sin
 * base de datos aparecia como una pantalla de configuración, que es justo lo
 * contrario de lo que debe ver un posible cliente. Ahora solo el formulario
 * pide sesión.
 */
const BENEFITS = [
  "Venta de entradas con inventario controlado: sin sobreventa, aunque dos personas compren a la vez.",
  "Mesas VIP con adelanto en linea y saldo en el local.",
  "Listas de invitados con aprobación automática o manual.",
  "Control de puerta con QR: cada código vale una sola vez y queda registrado.",
  "Reportes de asistentes y liquidación por evento, descargables en CSV.",
];

const STEPS = [
  ["1", "Envias los datos de tu local", "Nombre comercial, razon social, RUC, aforo y dirección."],
  ["2", "GETIN verifica la información", "Revisamos los datos antes de que aparezcas en el catálogo."],
  ["3", "Publicas tu primer evento", "Configuras entradas, mesas y listas desde tu panel."],
  ["4", "Cobras y controlas la puerta", "Los asistentes entran con su QR y tu ves las ventas en vivo."],
];

export default async function VenueRegistrationPage() {
  const session = await getSession();
  const demo = isDemoMode();

  return (
    <div className="container max-w-5xl py-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h1 className="text-display text-3xl sm:text-4xl">Publica tu discoteca en GETIN</h1>
          <p className="mt-3 text-sm text-muted">
            Vende tus entradas directamente, sin depender de promotores informales. Tus clientes
            compran en la plataforma, reciben su código y entran con el.
          </p>

          <ul className="mt-6 space-y-2">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime" />
                {benefit}
              </li>
            ))}
          </ul>

          <h2 className="text-display mt-8 text-xl">Como funciona</h2>
          <ol className="mt-3 space-y-3">
            {STEPS.map(([n, title, text]) => (
              <li key={n} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime text-xs font-bold text-ink">
                  {n}
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-xs text-muted">
            GETIN cobra una comisión por transacción, configurable por acuerdo comercial. El
            contrato y las condiciones de liquidación se revisan antes de activar los cobros.
          </p>
        </div>

        <div>
          {demo ? (
            <div className="surface p-6">
              <h2 className="text-display text-lg">Estas viendo una demostración</h2>
              <p className="mt-2 text-sm text-muted">
                Esta instalación corre con un catálogo de ejemplo y sin base de datos, así que el
                formulario de alta esta desactivado. Todo lo que ves arriba si esta implementado:
                el panel del local, la configuración de entradas y mesas, el control de puerta y
                los reportes.
              </p>
              <p className="mt-3 text-sm text-muted">
                Si gestionas un local y quieres publicarlo, escribenos y lo activamos.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild>
                  <a href="mailto:locales@getin.pe?subject=Quiero%20publicar%20mi%20local%20en%20GETIN">
                    Escribir a locales@getin.pe
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/eventos">Ver como se ve un evento</Link>
                </Button>
              </div>
            </div>
          ) : session ? (
            <VenueApplicationForm />
          ) : (
            <div className="surface p-6">
              <h2 className="text-display text-lg">Crea tu cuenta para continuar</h2>
              <p className="mt-2 text-sm text-muted">
                Necesitas una cuenta GETIN para enviar la solicitud: desde ella gestionaras tu
                local, tus eventos y tu personal de puerta.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/registro?siguiente=/club/registro">Crear cuenta</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login?siguiente=/club/registro">Ya tengo cuenta</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
