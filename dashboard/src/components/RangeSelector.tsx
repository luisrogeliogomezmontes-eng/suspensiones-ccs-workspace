"use client";

import { RANGES, type RangeKey } from "@/lib/useHistory";

// Control segmentado de rango de tiempo (I2).
export function RangeSelector({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (k: RangeKey) => void;
}) {
  return (
    <div
      className="inline-flex rounded-md border border-line bg-panel-2/60 p-0.5"
      role="group"
      aria-label="Rango de tiempo"
    >
      {RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(r.key)}
            aria-pressed={active}
            className={`rounded px-3 py-1 font-mono text-xs font-semibold transition-colors ${
              active ? "bg-signal text-black" : "text-ink-dim hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
