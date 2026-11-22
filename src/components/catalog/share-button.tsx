"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Compartir un evento.
 *
 * Usa `navigator.share`, la hoja nativa del sistema: en el movil abre WhatsApp,
 * Instagram o lo que tenga la persona, que es como se reparte realmente un plan
 * de noche. Donde no exista (escritorio), copia el enlace al portapapeles.
 *
 * No necesita cuenta ni base de datos: funciona igual en el catalogo de
 * demostracion que con datos reales.
 */
export function ShareButton({
  title,
  text,
  className,
}: {
  title: string;
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // Cancelar la hoja de compartir lanza AbortError: no es un fallo.
        if (error instanceof Error && error.name === "AbortError") return;
        // Cualquier otro problema cae al portapapeles.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado", { description: "Ya puedes pegarlo donde quieras." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No pudimos copiar el enlace", {
        description: "Copialo desde la barra de direcciones.",
      });
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={share} className={className}>
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Copiado" : "Compartir"}
    </Button>
  );
}
