import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description: "Respuestas a las dudas más frecuentes sobre entradas, mesas, listas y reembolsos.",
};

const SECTIONS = [
  {
    title: "Entradas y códigos QR",
    items: [
      {
        q: "Compre una entrada y no me llego nada",
        a: "Entra a «Mis entradas» en tu cuenta: si el pago quedó confirmado, la entrada y su QR estan ahi, incluso si el correo se demoro. Si la orden sigue en «pendiente», el proveedor de pagos aún no confirmo el cobro; la entrada se emite solo cuando lo haga.",
      },
      {
        q: "¿Puedo transferir mi entrada a otra persona?",
        a: "La entrada queda asociada a tu cuenta. Si va a entrar otra persona, escríbenos a soporte@getin.pe con el código de tu orden y lo coordinamos con el local.",
      },
      {
        q: "Mi QR aparece como ya utilizado",
        a: "Cada QR es de un solo uso. Si no lo usaste tu, es posible que alguien tuviera una captura del código. Acude al personal del local con tu código de orden: cada validación queda registrada con fecha y hora.",
      },
      {
        q: "¿Necesito imprimir la entrada?",
        a: "No. Basta con mostrar el QR en la pantalla del celular. Te recomendamos tomar una captura por si no tienes señal en la puerta.",
      },
    ],
  },
  {
    title: "Mesas VIP",
    items: [
      {
        q: "¿Qué pago ahora y qué pago en el local?",
        a: "En la plataforma pagas el adelanto. El saldo de la mesa y el consumo mínimo, si corresponde, se abonan en el establecimiento. Todos los importes se muestran antes de confirmar.",
      },
      {
        q: "¿Mi mesa puede venderse a otra persona?",
        a: "No. Al confirmarse tu reserva, esa mesa queda bloqueada para ese evento y no se ofrece a nadie mas.",
      },
    ],
  },
  {
    title: "Listas de invitados",
    items: [
      {
        q: "Estoy en la lista, ¿tengo el ingreso asegurado?",
        a: "No. Una lista es una cortesia del local sujeta a cupo, a un horario límite de ingreso y al criterio de admisión. Te recomendamos llegar con margen.",
      },
      {
        q: "Mi solicitud sigue pendiente",
        a: "Algunas listas requieren aprobación manual del local. Veras el cambio de estado en «Mis listas» y te avisaremos por correo.",
      },
    ],
  },
  {
    title: "Pagos y seguridad",
    items: [
      {
        q: "¿GETIN guarda mi tarjeta?",
        a: "No. Los datos de la tarjeta van directamente al proveedor de pagos. GETIN solo conserva la marca y los cuatro ultimos digitos para que reconozcas la operación.",
      },
      {
        q: "Me cobraron y la orden sigue pendiente",
        a: "Puede ocurrir si el aviso del proveedor se demora. Espera unos minutos y recarga «Mis compras». Si tras una hora sigue pendiente, escribenos con el código de la orden: no se emiten dos cobros por la misma compra.",
      },
      {
        q: "¿Por que no debo pagar a un promotor por transferencia?",
        a: "Porque no hay forma de verificar que la entrada existe. GETIN nace precisamente para eso: compras en la plataforma, el inventario es real y recibes un QR verificable emitido por el sistema.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="text-display text-3xl sm:text-4xl">Centro de ayuda</h1>
      <p className="mt-2 text-sm text-muted">
        Si no encuentras tu caso, escribenos a{" "}
        <a href="mailto:soporte@getin.pe" className="text-lime hover:underline">
          soporte@getin.pe
        </a>
        .
      </p>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-display mb-3 text-xl">{section.title}</h2>
            <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-surface">
              {section.items.map((item) => (
                <details key={item.q} className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 text-sm font-medium marker:content-none">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-lime transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-4 pb-4 text-sm text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        También puedes revisar los{" "}
        <Link href="/legal/terminos" className="text-lime hover:underline">
          terminos del servicio
        </Link>{" "}
        y la{" "}
        <Link href="/legal/reembolsos" className="text-lime hover:underline">
          política de reembolsos
        </Link>
        .
      </p>
    </div>
  );
}
