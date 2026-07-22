"use client";

import { useMemo, useState } from "react";
import type { Reading } from "@/lib/types";
import { hhmm, fmt } from "@/lib/format";
import { useContainerWidth } from "@/lib/useContainerWidth";

const H = 150;
const PAD = { top: 12, right: 14, bottom: 22, left: 40 };

// Línea genérica de una métrica en el tiempo (un solo eje, autoescala).
// Para temperatura usar TemperatureChart (tiene bandas de umbral); esto es
// para velocidad, RSSI, potencia, etc.
export function MetricChart({
  readings,
  accessor,
  unit,
  digits = 0,
  color = "var(--signal)",
  label,
}: {
  readings: Reading[];
  accessor: (r: Reading) => number | null | undefined;
  unit: string;
  digits?: number;
  color?: string;
  label: string;
}) {
  const { ref, width } = useContainerWidth(680);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const model = useMemo(() => {
    const pts = readings
      .map((r) => ({ t: new Date(r.ts).getTime(), v: accessor(r) ?? null }))
      .filter((p) => Number.isFinite(p.t));

    const vals = pts.map((p) => p.v).filter((v): v is number => v != null);
    const hasData = vals.length > 0;
    const rawMin = hasData ? Math.min(...vals) : 0;
    const rawMax = hasData ? Math.max(...vals) : 1;
    const pad = (rawMax - rawMin) * 0.12 || Math.abs(rawMax) * 0.1 || 1;
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;

    const tMin = pts.length ? pts[0].t : 0;
    const tMax = pts.length ? pts[pts.length - 1].t : 1;
    const tSpan = tMax - tMin || 1;

    const iw = Math.max(1, width - PAD.left - PAD.right);
    const ih = H - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - tMin) / tSpan) * iw;
    const y = (v: number) =>
      PAD.top + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;

    let d = "";
    let pen = false;
    for (const p of pts) {
      if (p.v == null) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)} `;
      pen = true;
    }

    const yTicks = [yMin, (yMin + yMax) / 2, yMax];
    const xTicks = pts.length
      ? Array.from({ length: 4 }, (_, i) => tMin + (tSpan * i) / 3)
      : [];

    return { pts, d, yTicks, xTicks, x, y, iw, hasData };
  }, [readings, accessor, width]);

  const hover = useMemo(() => {
    if (hoverX == null || !model.pts.length) return null;
    let best = model.pts[0];
    let bestDx = Infinity;
    for (const p of model.pts) {
      if (p.v == null) continue;
      const dx = Math.abs(model.x(p.t) - hoverX);
      if (dx < bestDx) { bestDx = dx; best = p; }
    }
    return best.v == null ? null : best;
  }, [hoverX, model]);

  if (!model.hasData) {
    return (
      <div ref={ref} className="grid h-[150px] w-full place-items-center rounded-md bg-panel-2/40 text-sm text-ink-faint">
        Sin datos de {label.toLowerCase()} en este rango
      </div>
    );
  }

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={H}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoverX(e.clientX - rect.left);
        }}
        onMouseLeave={() => setHoverX(null)}
        role="img"
        aria-label={`${label} en el tiempo`}
      >
        {model.yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={model.y(v)}
              y2={model.y(v)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={model.y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-[var(--ink-faint)] font-mono text-[10px]"
            >
              {fmt(v, digits)}
            </text>
          </g>
        ))}

        {model.xTicks.map((t, i) => (
          <text
            key={i}
            x={model.x(t)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === model.xTicks.length - 1 ? "end" : "middle"}
            className="fill-[var(--ink-faint)] font-mono text-[10px]"
          >
            {hhmm(t)}
          </text>
        ))}

        <path
          d={model.d}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hover && (
          <g>
            <line
              x1={model.x(hover.t)}
              x2={model.x(hover.t)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--ink-dim)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={model.x(hover.t)}
              cy={model.y(hover.v!)}
              r={3.5}
              fill={color}
              stroke="var(--panel)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-md border border-line bg-panel-2/95 px-2.5 py-1.5 shadow-lg"
          style={{ left: Math.min(Math.max(model.x(hover.t) + 10, 8), width - 120) }}
        >
          <div className="font-mono text-[11px] text-ink-faint">{hhmm(hover.t)}</div>
          <div className="tabular font-mono text-base text-ink">
            {fmt(hover.v, digits)}
            <span className="ml-0.5 text-[11px] text-ink-faint">{unit}</span>
          </div>
        </div>
      )}
    </div>
  );
}
