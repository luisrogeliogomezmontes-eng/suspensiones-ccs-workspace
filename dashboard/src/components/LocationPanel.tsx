"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Reading } from "@/lib/types";
import { fmt } from "@/lib/format";
import { IconPin } from "@/components/ui/icons";

// Leaflet toca `window` → cargar solo en cliente.
const MiniMap = dynamic(() => import("./map/MiniMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-panel-2" />,
});

export function LocationPanel({ readings }: { readings: Reading[] }) {
  const trail = useMemo(
    () =>
      readings
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => [r.lat as number, r.lng as number] as [number, number]),
    [readings]
  );

  const latest = readings.at(-1) ?? null;
  const current = trail.at(-1) ?? null;
  // Mostramos el mapa apenas hay lat/lng (aunque el fix sea débil). El nº de
  // satélites solo matiza la calidad, no bloquea la vista.
  const hasPos = current != null;
  const weakFix = hasPos && (latest?.sats ?? 0) < 4;

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-md border border-line">
        {hasPos ? (
          <>
            <MiniMap trail={trail.slice(-300)} current={current} />
            {/* Coordenadas superpuestas sobre el mapa */}
            <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded bg-panel/85 px-2 py-1 font-mono text-[11px] text-ink shadow-sm backdrop-blur">
              {current[0].toFixed(6)}, {current[1].toFixed(6)}
            </div>
            {weakFix && (
              <div className="absolute right-2 top-2 z-[1000] rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-black">
                señal débil ({fmt(latest?.sats ?? 0)} sat)
              </div>
            )}
          </>
        ) : (
          <div className="grid h-full place-items-center bg-panel-2 p-6 text-center">
            <div>
              <IconPin className="mx-auto mb-2 text-ink-faint" width={26} height={26} />
              <p className="text-sm text-ink-dim">
                {latest ? "Buscando satélites…" : "Sin datos de ubicación"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-ink-faint">
                {fmt(latest?.sats ?? 0)} satélites a la vista
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Lecturas GPS */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <Stat label="Latitud" value={current ? current[0].toFixed(5) : "—"} unit="°" />
        <Stat label="Longitud" value={current ? current[1].toFixed(5) : "—"} unit="°" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Stat label="Velocidad" value={fmt(latest?.speed_kmph, 0)} unit="km/h" />
        <Stat label="Satélites" value={fmt(latest?.sats ?? 0)} unit="" />
        <Stat label="HDOP" value={fmt(latest?.hdop, 1)} unit="" />
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md border border-line bg-panel-2/60 py-2">
      <div className="eyebrow text-[9px]">{label}</div>
      <div className="tabular font-mono text-lg text-ink">
        {value}
        {unit && <span className="ml-0.5 text-[11px] text-ink-faint">{unit}</span>}
      </div>
    </div>
  );
}
