import { Building2, LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Cómo contactar al equipo de GETIN: soporte, locales, privacidad y prensa.",
};

const CHANNELS = [
  {
    icon: LifeBuoy,
    title: "Soporte a compradores",
    email: "soporte@getin.pe",
    text: "Problemas con una compra, una entrada o un reembolso. Incluye el código de la orden (GETIN-XXXXXX).",
  },
  {
    icon: Building2,
    title: "Discotecas y eventos",
    email: "locales@getin.pe",
    text: "Quieres publicar tu local, revisar tu liquidación o cambiar tus condiciones comerciales.",
  },
  {
    icon: ShieldCheck,
    title: "Privacidad y datos personales",
    email: "privacidad@getin.pe",
    text: "Ejercicio de derechos de acceso, rectificación, cancelación y oposición (Ley 29733).",
  },
];

export default function ContactPage() {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="text-display text-3xl sm:text-4xl">Contacto</h1>
      <p className="mt-2 text-sm text-muted">
        Escribimos en español y respondemos en horario de oficina (Lima, UTC-5).
      </p>

      <div className="mt-8 space-y-3">
        {CHANNELS.map((channel) => (
          <div key={channel.email} className="surface flex gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime/10">
              <channel.icon className="size-5 text-lime" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold">{channel.title}</h2>
              <p className="mt-1 text-sm text-muted">{channel.text}</p>
              <a
                href={`mailto:${channel.email}`}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-lime hover:underline"
              >
                <Mail className="size-3.5" />
                {channel.email}
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="surface mt-6 p-5">
        <h2 className="font-display text-base font-semibold">Datos de la empresa</h2>
        <p className="mt-2 text-sm text-muted">
          Los datos registrales (razon social, RUC y domicilio fiscal) deben publicarse aquí antes
          del lanzamiento comercial, como exige la normativa peruana de protección al consumidor.
          Quedan pendientes hasta la constitucion de la empresa.
        </p>
        <div className="mt-3 flex flex-col gap-1.5 text-sm">
          <Link href="/legal/libro-de-reclamaciones" className="text-lime hover:underline">
            Libro de Reclamaciones →
          </Link>
          <Link href="/legal/terminos" className="text-lime hover:underline">
            Ver terminos y condiciones →
          </Link>
        </div>
      </div>
    </div>
  );
}
