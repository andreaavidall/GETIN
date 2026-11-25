"use client";

import { Disc3 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Portada de un evento o de un local.
 *
 * Dos cosas que antes no estaban:
 *
 *  · Si la imagen no carga —la URL murió, el servidor no responde— no se
 *    queda un rectángulo negro. Se dibuja un fondo de marca con la inicial
 *    del nombre, que al menos identifica la tarjeta.
 *  · El oscurecimiento va DETRÁS del texto, no sobre toda la foto. Apagar la
 *    imagen entera para que se lea una línea deja la portada sin atractivo,
 *    que es justo lo que se compra con la vista.
 *
 * No sustituye una foto que falta por otra parecida: una portada de archivo
 * presentada como el local es exactamente lo que no se puede hacer.
 */
export function CoverImage({
  src,
  alt,
  name,
  priority = false,
  sizes = "100vw",
  className,
  scrim = true,
}: {
  src: string | null;
  alt: string;
  /** Para la inicial del respaldo cuando no hay imagen. */
  name: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  scrim?: boolean;
}) {
  const [falló, setFalló] = useState(false);
  const inicial = name.trim().charAt(0).toUpperCase() || "G";

  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-white/[0.04]", className)}>
      {src && !falló ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          onError={() => setFalló(true)}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="photo-fallback absolute inset-0 flex items-center justify-center">
          <span className="flex items-center gap-2 text-white/25">
            <Disc3 className="size-7" aria-hidden="true" />
            <span className="font-display text-4xl font-bold">{inicial}</span>
          </span>
        </div>
      )}

      {scrim ? <div className="photo-scrim absolute inset-0" /> : null}
    </div>
  );
}
