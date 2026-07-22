import type { ReactNode } from "react";
import { type Level, LEVEL_META, levelColor } from "@/lib/status";

// Un "testigo" tipo luz de tablero: lámpara de estado + ícono + lectura mono.
// El COLOR vive en la lámpara y el glifo de estado; el número queda en tinta.
export function Telltale({
  icon,
  label,
  value,
  unit,
  level = "unknown",
  accent,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  level?: Level;
  // Acento propio (CSS color) desacoplado de severidad — p.ej. fan activo.
  accent?: string;
  sub?: ReactNode;
}) {
  const meta = LEVEL_META[level];
  const color = accent ?? levelColor(level);
  const lit = accent != null || level !== "unknown";
  const showGlyph = accent == null && lit && level !== "ok";

  return (
    <div className="flex min-w-[132px] flex-col gap-1.5 rounded-md border border-line bg-panel-2/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        {/* Lámpara */}
        <span
          className="relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            background: color,
            boxShadow: lit ? `0 0 8px ${color}` : "none",
          }}
          aria-hidden="true"
        />
        <span className="text-ink-dim" style={{ color: lit ? color : undefined }}>
          {icon}
        </span>
        <span className="eyebrow text-[10px]">{label}</span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="tabular font-mono text-2xl font-medium leading-none text-ink">
          {value}
        </span>
        {unit && <span className="font-mono text-xs text-ink-faint">{unit}</span>}
        {showGlyph && (
          <span className="ml-auto text-xs" style={{ color }} title={meta.label}>
            {meta.glyph} <span className="sr-only">{meta.label}</span>
          </span>
        )}
      </div>

      {sub && <div className="h-[26px]">{sub}</div>}
    </div>
  );
}
