"use client";

import { useMemo } from "react";
import type { Reading } from "@/lib/types";
import { fmt } from "@/lib/format";
import { useContainerWidth } from "@/lib/useContainerWidth";

const H = 26;

// Timeline categórico ON/OFF del ventilador (bloques con 2px de separación).
export function FanTimeline({ readings }: { readings: Reading[] }) {
  const { ref, width } = useContainerWidth(680);

  const model = useMemo(() => {
    const pts = readings
      .map((r) => ({ t: new Date(r.ts).getTime(), on: r.fan_on === true }))
      .filter((p) => Number.isFinite(p.t));
    if (pts.length < 2) return { blocks: [], onPct: 0 };

    const tMin = pts[0].t;
    const tMax = pts[pts.length - 1].t;
    const span = tMax - tMin || 1;
    const x = (t: number) => (width * (t - tMin)) / span;

    const blocks: { x0: number; x1: number }[] = [];
    let start: number | null = null;
    let onMs = 0;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].on && start == null) start = pts[i].t;
      if (!pts[i].on && start != null) {
        blocks.push({ x0: x(start), x1: x(pts[i].t) });
        onMs += pts[i].t - start;
        start = null;
      }
    }
    if (start != null) { blocks.push({ x0: x(start), x1: x(tMax) }); onMs += tMax - start; }

    return { blocks, onPct: Math.round((onMs / span) * 100) };
  }, [readings, width]);

  const lastDuty = readings.at(-1)?.fan_duty ?? 0;

  return (
    <div>
      <div ref={ref} className="w-full">
        <svg width={width} height={H} role="img" aria-label="Estado del ventilador en el tiempo">
          <rect x={0} y={0} width={width} height={H} rx={4} fill="var(--panel-2)" />
          {model.blocks.map((b, i) => (
            <rect
              key={i}
              x={b.x0 + 1}
              y={4}
              width={Math.max(1, b.x1 - b.x0 - 2)}
              height={H - 8}
              rx={2}
              fill="var(--signal)"
              opacity={0.85}
            />
          ))}
        </svg>
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-ink-faint">
        <span>demanda de enfriamiento {fmt(model.onPct)}% del tiempo</span>
        <span>duty actual {fmt(lastDuty)}%</span>
      </div>
    </div>
  );
}
