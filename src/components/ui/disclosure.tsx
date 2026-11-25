"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Sección plegable.
 *
 * Para texto largo que no todo el mundo necesita leer entero: reglas del
 * local, descripción extensa, fotos. Lo que condiciona la compra —edad,
 * último ingreso, devoluciones— no se pliega o se abre por defecto.
 *
 * Es un `<button>` con `aria-expanded` y la región asociada, no un `div` con
 * un `onClick`: así funciona con teclado y lo anuncia un lector de pantalla.
 */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(defaultOpen);
  const id = `disc-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-4 py-1 text-left"
      >
        <span className="font-display text-base font-semibold">{title}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted transition-transform duration-200",
            abierto && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div id={id} hidden={!abierto} className="mt-3">
        {children}
      </div>
    </div>
  );
}
