import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import { VenueApplicationForm } from "@/components/club/venue-application-form";
import { requireSession } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Publicar mi local",
  description:
    "Registra tu discoteca en GETIN: vende entradas, administra mesas VIP y controla el ingreso con codigos QR.",
};

const BENEFITS = [
  "Venta de entradas con inventario controlado: sin sobreventa.",
  "Mesas VIP con adelanto y saldo en el local.",
  "Listas de invitados con aprobacion automatica o manual.",
  "Control de puerta con QR y registro de cada ingreso.",
  "Reportes de asistentes y liquidacion por evento.",
];

export default async function VenueRegistrationPage() {
  await requireSession("/club/registro");

  return (
    <div className="container grid max-w-5xl gap-8 py-10 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="text-display text-3xl">Publica tu discoteca en GETIN</h1>
        <p className="mt-3 text-sm text-muted">
          Completa los datos comerciales de tu local. El equipo de GETIN verifica la informacion
          antes de publicarlo en el catalogo: hasta entonces puedes preparar eventos y entradas,
          pero no se podran comprar.
        </p>

        <ul className="mt-6 space-y-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime" />
              {benefit}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-muted">
          GETIN cobra una comision por transaccion, configurable por acuerdo comercial. El contrato
          y las condiciones de liquidacion se revisan antes de activar los cobros.
        </p>
      </div>

      <VenueApplicationForm />
    </div>
  );
}
