"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Carrusel táctil para móvil.
 *
 * En una pantalla estrecha, tres tarjetas apiladas obligan a desplazar mucho
 * antes de llegar a lo siguiente. Aquí se desliza con el dedo y asoma parte
 * de la tarjeta siguiente, que es lo que indica que hay más sin necesidad de
 * explicarlo.
 *
 * A partir de `sm` deja de ser carrusel y pasa a rejilla: en pantalla ancha
 * el deslizamiento horizontal estorba más de lo que ayuda.
 *
 * Los controles existen de verdad: son botones con nombre, llegables con el
 * tabulador. Un carrusel que solo responde al dedo deja fuera a quien navega
 * con teclado.
 */
export function EventCarousel({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const [alInicio, setAlInicio] = useState(true);
  const [alFinal, setAlFinal] = useState(false);

  const revisar = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    setAlInicio(el.scrollLeft <= 4);
    setAlFinal(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    revisar();
    const el = pista.current;
    if (!el) return;
    el.addEventListener("scroll", revisar, { passive: true });
    window.addEventListener("resize", revisar);
    return () => {
      el.removeEventListener("scroll", revisar);
      window.removeEventListener("resize", revisar);
    };
  }, [revisar]);

  function mover(dir: -1 | 1) {
    const el = pista.current;
    if (!el) return;
    // Un "paso" es el ancho de una tarjeta: no media ni dos.
    const paso = el.firstElementChild instanceof HTMLElement ? el.firstElementChild.offsetWidth + 16 : 280;
    el.scrollBy({ left: dir * paso, behavior: "smooth" });
  }

  return (
    <div className={cn("relative", className)}>
      <div
        ref={pista}
        role="region"
        aria-label={label}
        className={cn(
          "scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1",
          // En movil cada tarjeta ocupa el 82%: el 18% restante deja ver la
          // siguiente y cuenta por si sola que hay mas.
          "[&>*]:w-[82%] [&>*]:shrink-0 [&>*]:snap-start",
          "sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3",
          "sm:[&>*]:w-auto",
        )}
      >
        {children}
      </div>

      {/* Controles solo donde hay carrusel. */}
      <div className="mt-3 flex justify-end gap-2 sm:hidden">
        <CarouselButton
          onClick={() => mover(-1)}
          disabled={alInicio}
          label={`Anterior en ${label}`}
          icon={<ChevronLeft className="size-4" />}
        />
        <CarouselButton
          onClick={() => mover(1)}
          disabled={alFinal}
          label={`Siguiente en ${label}`}
          icon={<ChevronRight className="size-4" />}
        />
      </div>
    </div>
  );
}

function CarouselButton({
  onClick,
  disabled,
  label,
  icon,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] transition-opacity duration-200",
        disabled ? "opacity-30" : "hover:border-lime/50 hover:text-lime",
      )}
    >
      {icon}
    </button>
  );
}
