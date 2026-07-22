"use client";

import { useMemo, useState } from "react";
import type { Reading, TempThresholds } from "@/lib/types";
import { tempLevel, levelColor } from "@/lib/status";
import { hhmm, fmt } from "@/lib/format";
import { useContainerWidth } from "@/lib/useContainerWidth";

const H = 240;
const PAD = { top: 12, right: 14, bottom: 22, left: 34 };

export function TemperatureChart({
  readings,
  thr,
}: {
  readings: Reading[];
  thr: TempThresholds;
}) {
  const { ref, width } = useContainerWidth(680);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const model = useMemo(() => {
    const pts = readings
      .map((r) => ({ t: new Date(r.ts).getTime(), v: r.temp_c, fan: r.fan_on }))
      .filter((p) => Number.isFinite(p.t));

    const vals = pts.map((p) => p.v).filter((v): v is number => v != null);
    const dataMax = vals.length ? Math.max(...vals) : thr.crit;
    const yMin = 30;
    const yMax = Math.max(thr.crit + 8, Math.ceil((dataMax + 4) / 5) * 5);

    const tMin = pts.length ? pts[0].t : 0;
    const tMax = pts.length ? pts[pts.length - 1].t : 1;
    const tSpan = tMax - tMin || 1;

    const iw = Math.max(1, width - PAD.left - PAD.right);
    const ih = H - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - tMin) / tSpan) * iw;
    const y = (v: number) => PAD.top + ih - ((v - yMin) / (yMax - yMin)) * ih;

    // Línea de temperatura (rompe en huecos nulos)
    let d = "";
    let pen = false;
    for (const p of pts) {
      if (p.v == null) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)} `;
      pen = true;
    }

    // Bandas verticales de fan-ON (banda sombreada, NO segundo eje)
    const fanBands: { x0: number; x1: number }[] = [];
    let start: number | null = null;
    for (let i = 0; i < pts.length; i++) {
      const on = pts[i].fan === true;
      if (on && start == null) start = pts[i].t;
      if (!on && start != null) { fanBands.push({ x0: x(start), x1: x(pts[i].t) }); start = null; }
    }
    if (start != null) fanBands.push({ x0: x(start), x1: x(tMax) });

    // Bandas horizontales de umbral (fondo)
    const zones = [
      { from: yMin, to: thr.warn, level: "ok" as const },
      { from: thr.warn, to: thr.serious, level: "warn" as const },
      { from: thr.serious, to: thr.crit, level: "serious" as const },
      { from: thr.crit, to: yMax, level: "crit" as const },
    ].map((z) => ({ ...z, y0: y(Math.min(z.to, yMax)), y1: y(Math.max(z.from, yMin)) }));

    // Ticks
    const yTicks: number[] = [];
    for (let v = Math.ceil(yMin / 10) * 10; v <= yMax; v += 10) yTicks.push(v);
    const xTicks = pts.length
      ? Array.from({ length: 5 }, (_, i) => tMin + (tSpan * i) / 4)
      : [];

    return { pts, d, fanBands, zones, yTicks, xTicks, x, y, yMin, yMax, tMin, tMax, iw };
  }, [readings, thr, width]);

  // Punto bajo el cursor
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

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverX(e.clientX - rect.left);
  };

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={H}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverX(null)}
        role="img"
        aria-label="Temperatura en el tiempo con bandas de umbral y ventilador"
      >
        {/* Zonas de umbral */}
        {model.zones.map((z, i) => (
          <rect
            key={i}
            x={PAD.left}
            y={z.y0}
            width={model.iw}
            height={Math.max(0, z.y1 - z.y0)}
            fill={levelColor(z.level)}
            opacity={{ ok: 0.06, warn: 0.12, serious: 0.15, crit: 0.16 }[z.level]}
          />
        ))}

        {/* Bandas de fan-ON */}
        {model.fanBands.map((b, i) => (
          <rect
            key={i}
            x={b.x0}
            y={PAD.top}
            width={Math.max(0.5, b.x1 - b.x0)}
            height={H - PAD.top - PAD.bottom}
            fill="var(--signal)"
            opacity={0.08}
          />
        ))}

        {/* Grid + labels Y */}
        {model.yTicks.map((v) => (
          <g key={v}>
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
              {v}
            </text>
          </g>
        ))}

        {/* Labels X */}
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

        {/* Línea de temperatura */}
        <path
          d={model.d}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crosshair + punto */}
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
              fill="var(--ink)"
              stroke="var(--panel)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hover && (
        <Tooltip
          x={model.x(hover.t)}
          width={width}
          time={hhmm(hover.t)}
          temp={hover.v!}
          fan={hover.fan === true}
          level={tempLevel(hover.v, thr)}
        />
      )}
    </div>
  );
}

function Tooltip({
  x,
  width,
  time,
  temp,
  fan,
  level,
}: {
  x: number;
  width: number;
  time: string;
  temp: number;
  fan: boolean;
  level: ReturnType<typeof tempLevel>;
}) {
  const left = Math.min(Math.max(x + 10, 8), width - 130);
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-md border border-line bg-panel-2/95 px-2.5 py-1.5 shadow-lg"
      style={{ left }}
    >
      <div className="font-mono text-[11px] text-ink-faint">{time}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: levelColor(level) }}
        />
        <span className="tabular font-mono text-base text-ink">{fmt(temp, 1)}°C</span>
      </div>
      <div className="font-mono text-[10px] text-ink-faint">
        fan {fan ? "ON" : "OFF"}
      </div>
    </div>
  );
}
