"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AppHeader } from "@/components/AppHeader";
import { useDeviceId } from "@/lib/devices";
import { useHistory, RANGES, type RangeKey } from "@/lib/useHistory";
import { RangeSelector } from "@/components/RangeSelector";
import { fmt } from "@/lib/format";
import { IconPin } from "@/components/ui/icons";

const MiniMap = dynamic(() => import("@/components/map/MiniMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-panel-2" />,
});

export default function Mapa() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("6h");
  const rangeMs = RANGES.find((r) => r.key === rangeKey)!.ms;
  const { readings, loading } = useHistory(rangeMs, useDeviceId());

  const trail = useMemo(
    () =>
      readings
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => [r.lat as number, r.lng as number] as [number, number]),
    [readings]
  );
  const current = trail.at(-1) ?? null;
  const latest = readings.at(-1) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <RangeSelector value={rangeKey} onChange={setRangeKey} />
          <div className="font-mono text-[11px] text-ink-faint">
            {loading ? "cargando…" : `${fmt(trail.length)} puntos de ruta`}
          </div>
          <div className="ml-auto flex gap-2 font-mono text-xs text-ink-dim">
            <span>vel {fmt(latest?.speed_kmph, 0)} km/h</span>
            <span>·</span>
            <span>{fmt(latest?.sats ?? 0)} sat</span>
          </div>
        </div>

        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-lg border border-line">
          {current ? (
            <>
              <MiniMap trail={trail} current={current} />
              <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded bg-panel/85 px-2.5 py-1.5 font-mono text-xs text-ink shadow-sm backdrop-blur">
                {current[0].toFixed(6)}, {current[1].toFixed(6)}
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center bg-panel-2 p-6 text-center">
              <div>
                <IconPin className="mx-auto mb-2 text-ink-faint" width={28} height={28} />
                <p className="text-sm text-ink-dim">
                  {loading ? "Cargando ruta…" : "Sin datos de ubicación en este rango"}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
