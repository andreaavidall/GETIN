"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import Link from "next/link";
import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import { formatEventDate, formatPENShort } from "@/lib/utils";

/**
 * Mapa de locales.
 *
 * Teselas de OpenStreetMap: sin clave de API y sin mandar nada del usuario a
 * un tercero más allá de la petición de la tesela. Atribución incluida, que
 * es lo que su licencia exige.
 *
 * El marcador por defecto de Leaflet apunta a imágenes que el empaquetador no
 * resuelve, así que se dibuja con un icono propio en HTML: además permite
 * poner el precio dentro y que se lea de un vistazo.
 */
export type MapPoint = {
  id: string;
  slug: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  /** Para el mapa de eventos. */
  eventName?: string;
  startsAt?: Date;
  priceFromCents?: number | null;
  href: string;
};

function icono(destacado: boolean) {
  return L.divIcon({
    className: "",
    html: `<span class="flex size-7 items-center justify-center rounded-full border-2 ${
      destacado ? "border-lime bg-lime/90" : "border-white/70 bg-black/80"
    } shadow-lg">
      <span class="size-2 rounded-full ${destacado ? "bg-black" : "bg-lime"}"></span>
    </span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export function VenueMap({ points }: { points: MapPoint[] }) {
  // Centro: el promedio de lo que hay en pantalla. Si no hay nada con
  // coordenadas, el mapa no se dibuja (lo decide quien lo llama).
  const centro = useMemo<[number, number]>(() => {
    const lat = points.reduce((a, p) => a + p.lat, 0) / points.length;
    const lng = points.reduce((a, p) => a + p.lng, 0) / points.length;
    return [lat, lng];
  }, [points]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <MapContainer
        center={centro}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "clamp(320px, 60vh, 560px)", width: "100%", background: "#111" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icono(Boolean(p.eventName))}>
            <Popup>
              <div className="min-w-[180px] space-y-1 text-[13px] leading-snug">
                <p className="font-semibold">{p.eventName ?? p.name}</p>
                {p.eventName ? <p className="text-black/70">{p.name}</p> : null}
                <p className="text-black/60">{p.district}</p>
                {p.startsAt ? (
                  <p className="text-black/60">{formatEventDate(p.startsAt)}</p>
                ) : null}
                {typeof p.priceFromCents === "number" ? (
                  <p className="font-semibold">Desde {formatPENShort(p.priceFromCents)}</p>
                ) : null}
                <Link href={p.href} className="mt-1 inline-block font-semibold text-[#1f6feb]">
                  Ver {p.eventName ? "evento" : "discoteca"} →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
