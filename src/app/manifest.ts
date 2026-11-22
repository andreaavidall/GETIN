import type { MetadataRoute } from "next";

/**
 * Manifiesto PWA.
 *
 * La app es instalable (pantalla completa, icono, tema negro). NO se registra
 * un service worker todavia: una cache mal planteada en una plataforma de
 * entradas puede mostrar disponibilidad vieja o un QR que ya no es valido. El
 * modo offline se abordara con una estrategia explicita por ruta.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GETIN · La noche empieza aquí",
    short_name: "GETIN",
    description:
      "Descubre eventos, compra entradas y reserva mesas VIP en las discotecas de Lima.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "es-PE",
    orientation: "portrait",
    categories: ["entertainment", "events", "lifestyle"],
    icons: [
      {
        // Icono provisional generado como SVG: sustituir por PNG definitivos
        // (192 y 512) cuando exista el logo final.
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
