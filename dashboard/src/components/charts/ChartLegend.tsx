import type { TempThresholds } from "@/lib/types";

// Leyenda de las bandas del gráfico de temperatura (las bandas necesitan clave).
export function ChartLegend({ thr }: { thr: TempThresholds }) {
  const items = [
    { label: `OK <${thr.warn}`, color: "var(--ok)" },
    { label: `Adv ${thr.warn}–${thr.serious}`, color: "var(--warn)" },
    { label: `Serio ${thr.serious}–${thr.crit}`, color: "var(--serious)" },
    { label: `Crít >${thr.crit}`, color: "var(--crit)" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-ink-faint">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: it.color, opacity: 0.5 }} />
          {it.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-3 rounded-sm" style={{ background: "var(--signal)", opacity: 0.5 }} />
        fan ON
      </span>
    </div>
  );
}
