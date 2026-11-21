import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Logotipo GETIN — version tipografica PROVISIONAL.
 *
 * No es el logo definitivo: es un marcador hecho con texto y CSS para no
 * bloquear el desarrollo. La "I" lleva un trazo vertical lima que insinua el
 * marco de una puerta abierta, pero una identidad de verdad tiene que dibujarla
 * un diseñador y entregarse como SVG. Cuando exista ese archivo, se sustituye
 * este componente por el <svg> y no hay que tocar nada mas.
 *
 * Reglas que si se respetan ya:
 *  - "GET" en blanco, "IN" en amarillo lima.
 *  - Legible a 16px de alto (sin iconos adicionales).
 */
export function Logo({
  className,
  size = "md",
  asLink = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-4xl sm:text-5xl",
  };

  const mark = (
    <span
      className={cn(
        "font-display font-bold leading-none tracking-[-0.04em] text-paper",
        sizes[size],
        className,
      )}
    >
      GET
      {/* La "I" como puerta entreabierta: trazo lima a un lado del asta. */}
      <span className="relative inline-block text-lime">
        I
        <span
          aria-hidden="true"
          className="absolute -right-[0.09em] bottom-[0.08em] top-[0.08em] w-[0.085em] rounded-[1px] bg-lime/55"
        />
      </span>
      <span className="text-lime">N</span>
    </span>
  );

  if (!asLink) return mark;

  return (
    <Link href="/" aria-label="GETIN · inicio" className="inline-flex items-center">
      {mark}
    </Link>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-xs font-semibold uppercase tracking-[0.3em]", className)}>
      GET IN. GO OUT.
    </span>
  );
}
