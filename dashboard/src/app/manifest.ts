import type { MetadataRoute } from "next";

// PWA (I4): hace la app instalable (icono en el cel, pantalla completa).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Suspensiones · Telemetría",
    short_name: "SC Telemetría",
    description: "Panel de la unidad móvil (ESP32 · Starlink · EcoFlow).",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e1116",
    theme_color: "#0e1116",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
