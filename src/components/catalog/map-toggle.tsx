"use client";

import { LayoutGrid, Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import type { MapPoint } from "@/components/catalog/venue-map";
import { cn } from "@/lib/utils";

/**
 * Alternar entre listado y mapa.
 *
 * El mapa se carga solo cuando se pide (`ssr: false` porque Leaflet toca
 * `window` al montarse). Así quien nunca abre el mapa no se descarga la
 * librería, que es la mitad del peso de la página.
 *
 * Los filtros no se tocan: el mapa pinta exactamente los mismos resultados
 * que el listado, porque recibe los que ya se cargaron.
 */
const VenueMap = dynamic(() => import("@/components/catalog/venue-map").then((m) => m.VenueMap), {
  ssr: false,
  loading: () => <div className="skeleton h-[420px] w-full rounded-2xl" />,
});

export function MapToggle({
  points,
  sinUbicacion,
  children,
}: {
  points: MapPoint[];
  /** Cuántos resultados no tienen coordenadas y por tanto no salen en el mapa. */
  sinUbicacion: number;
  children: React.ReactNode;
}) {
  const [vista, setVista] = useState<"lista" | "mapa">("lista");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-white/5 p-1">
          {(["lista", "mapa"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              aria-pressed={vista === v}
              disabled={v === "mapa" && points.length === 0}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                vista === v ? "bg-lime text-ink" : "text-muted hover:text-paper",
                v === "mapa" && points.length === 0 && "cursor-not-allowed opacity-40",
              )}
            >
              {v === "lista" ? <LayoutGrid className="size-3.5" /> : <MapIcon className="size-3.5" />}
              {v === "lista" ? "Lista" : "Mapa"}
            </button>
          ))}
        </div>

        {vista === "mapa" && sinUbicacion > 0 ? (
          <p className="text-[11px] text-muted">
            {sinUbicacion === 1
              ? "1 resultado sin ubicación no aparece en el mapa"
              : `${sinUbicacion} resultados sin ubicación no aparecen en el mapa`}
          </p>
        ) : null}
      </div>

      {vista === "mapa" ? <VenueMap points={points} /> : children}
    </div>
  );
}
