"use client";

import { Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * QR a pantalla completa.
 *
 * En la puerta, de noche, lo que falla es la luz: el lector necesita contraste.
 * Al ampliar se pinta sobre blanco puro y ocupando todo el ancho, que es lo
 * que mejor lee un escáner de teléfono.
 *
 * Se cierra con Escape y con el botón; el fondo blanco no es decorativo.
 */
export function QrZoom({ src, alt, serial }: { src: string; alt: string; serial: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    // Evita que la página de detrás se desplace mientras el QR está arriba.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-paper transition hover:bg-white/10"
      >
        <Maximize2 className="size-3.5" />
        Ampliar para la puerta
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Código QR ampliado de la entrada ${serial}`}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-white p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="w-full max-w-sm" />
          <p className="font-mono text-sm text-black/60">{serial}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
          >
            <X className="size-4" />
            Cerrar
          </button>
          <p className="max-w-xs text-center text-xs text-black/50">
            Sube el brillo de la pantalla si el lector no lo toma.
          </p>
        </div>
      ) : null}
    </>
  );
}
