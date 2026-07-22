"use client";

import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

type LatLng = [number, number];

// Recentra al moverse el punto vivo y corrige el tamaño (Leaflet dentro de un
// contenedor flex arranca en 0×0 → invalidateSize tras montar y al redimensionar).
function MapFx({ pos }: { pos: LatLng }) {
  const map = useMap();

  useEffect(() => {
    const fix = () => map.invalidateSize();
    // Varios reintentos: el panel flex puede tardar en asentar su altura.
    const timers = [0, 100, 300, 600].map((ms) => setTimeout(fix, ms));
    const container = map.getContainer();
    const ro = new ResizeObserver(fix);
    ro.observe(container);
    return () => {
      timers.forEach(clearTimeout);
      ro.disconnect();
    };
  }, [map]);

  useEffect(() => {
    map.setView(pos, map.getZoom(), { animate: true });
  }, [map, pos]);

  return null;
}

export default function MiniMap({
  trail,
  current,
}: {
  trail: LatLng[];
  current: LatLng;
}) {
  return (
    <MapContainer
      center={current}
      zoom={15}
      className="absolute inset-0"
      zoomControl={true}
      attributionControl={false}
      scrollWheelZoom={false}
      style={{ background: "var(--panel-2)" }}
    >
      {/* OpenStreetMap estándar: proveedor más fiable, sin API key. */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {trail.length > 1 && (
        <Polyline
          positions={trail}
          pathOptions={{ color: "#3b9eff", weight: 3, opacity: 0.85 }}
        />
      )}
      <CircleMarker
        center={current}
        radius={6}
        pathOptions={{ color: "#e6edf3", weight: 2, fillColor: "#3b9eff", fillOpacity: 1 }}
      />
      <MapFx pos={current} />
    </MapContainer>
  );
}
