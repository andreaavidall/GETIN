"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleFavoriteAction } from "@/lib/actions/favorites";
import { cn } from "@/lib/utils";

/**
 * Guardar un evento o un local.
 *
 * El estado se pinta al instante y se corrige si el servidor dice otra cosa:
 * esperar la respuesta para mover un corazón se siente roto en el celular.
 *
 * Sin sesión no se pretende que funcione: lleva al login y vuelve a donde
 * estaba. Es la misma regla que en mesas y listas.
 */
export function FavoriteButton({
  target,
  id,
  initial,
  isAuthenticated,
  next,
  label,
  variant = "icon",
}: {
  target: "event" | "venue";
  id: string;
  initial: boolean;
  isAuthenticated: boolean;
  next: string;
  label?: string;
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  const titulo = saved ? "Quitar de favoritos" : "Guardar en favoritos";

  function onClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      router.push(`/login?siguiente=${encodeURIComponent(next)}`);
      return;
    }

    const optimista = !saved;
    setSaved(optimista);

    startTransition(async () => {
      const result = await toggleFavoriteAction({ target, id });
      if (!result.ok) {
        setSaved(!optimista);
        toast.error("No se pudo guardar", { description: result.error });
        return;
      }
      setSaved(result.favorite);
      toast.success(result.favorite ? "Guardado en favoritos" : "Quitado de favoritos");
      router.refresh();
    });
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={saved}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition",
          saved
            ? "border-lime/40 bg-lime/10 text-lime"
            : "border-white/15 bg-white/5 text-paper hover:bg-white/10",
          pending && "opacity-60",
        )}
      >
        <Heart className={cn("size-4", saved && "fill-current")} />
        {label ?? (saved ? "Guardado" : "Guardar")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={titulo}
      title={titulo}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border backdrop-blur transition",
        saved
          ? "border-lime/40 bg-lime/15 text-lime"
          : "border-white/15 bg-black/50 text-white hover:bg-black/70",
        pending && "opacity-60",
      )}
    >
      <Heart className={cn("size-4", saved && "fill-current")} />
    </button>
  );
}
