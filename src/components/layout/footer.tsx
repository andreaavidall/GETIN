import Link from "next/link";

import { Logo, Wordmark } from "@/components/brand/logo";

const COLUMNS = [
  {
    title: "Descubrir",
    links: [
      { href: "/eventos", label: "Eventos" },
      { href: "/discotecas", label: "Discotecas" },
      { href: "/eventos?sort=price_asc", label: "Mas economicos" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: "/cuenta/entradas", label: "Mis entradas" },
      { href: "/cuenta/mesas", label: "Mis mesas" },
      { href: "/cuenta/listas", label: "Mis listas" },
      { href: "/cuenta/compras", label: "Historial" },
    ],
  },
  {
    title: "Para discotecas",
    links: [
      { href: "/club/registro", label: "Publicar mi local" },
      { href: "/club/dashboard", label: "Panel del local" },
      { href: "/ayuda", label: "Centro de ayuda" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terminos", label: "Terminos y condiciones" },
      { href: "/legal/privacidad", label: "Politica de privacidad" },
      { href: "/legal/reembolsos", label: "Politica de reembolsos" },
      { href: "/legal/libro-de-reclamaciones", label: "Libro de Reclamaciones" },
      { href: "/contacto", label: "Contacto" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/10 bg-ink">
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_3fr]">
          <div className="space-y-4">
            <Logo size="md" />
            <Wordmark className="block text-muted" />
            <p className="max-w-xs text-sm text-muted">
              Descubre la noche de Lima, asegura tu entrada y reserva tu mesa sin pasar por
              intermediarios informales.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-paper">
                  {col.title}
                </h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={`${col.title}-${link.href}`}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted transition-colors hover:text-paper"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} GETIN. Lima, Peru.</p>
          <p className="max-w-xl">
            Ingreso solo para mayores de 18 años. El ingreso a cada local depende de su aforo
            autorizado y de su derecho de admision. GETIN intermedia la venta: el servicio lo
            presta el establecimiento.
          </p>
        </div>
      </div>
    </footer>
  );
}
