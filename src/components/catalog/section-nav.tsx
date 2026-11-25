"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Navegación por secciones de la ficha.
 *
 * En móvil, elegir entradas obligaba a recorrer la descripción, el line-up,
 * los horarios y las reglas. Esta barra lleva directamente a lo que se vino a
 * hacer. Se queda pegada arriba al desplazar, debajo de la cabecera.
 *
 * Es una lista de enlaces de ancla de verdad: funciona con el teclado, con
 * lector de pantalla y sin JavaScript. Lo único que añade el script es
 * resaltar la sección en la que estás.
 */
export type Seccion = { id: string; label: string };

export function SectionNav({ sections }: { sections: Seccion[] }) {
  const [activa, setActiva] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      // La franja de arriba: una seccion cuenta como "actual" cuando su
      // principio esta en el tercio superior de la pantalla.
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Secciones del evento"
      className="sticky top-16 z-30 -mx-4 border-b border-white/10 bg-ink/90 px-4 backdrop-blur"
    >
      <ul className="scrollbar-none flex gap-1 overflow-x-auto">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={activa === s.id ? "true" : undefined}
              className={cn(
                "block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors duration-200",
                activa === s.id
                  ? "border-lime text-lime"
                  : "border-transparent text-muted hover:text-paper",
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
