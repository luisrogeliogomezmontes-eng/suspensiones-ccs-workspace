// Anillo de progreso (SVG). Componente puro, sin estado.

export function Ring({
  pct,
  size = 84,
  stroke = 9,
  color = "var(--signal)",
  label,
  sub,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const off = c * (1 - p / 100);
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--grid)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute grid place-items-center text-center leading-none">
        <span className="num text-lg font-bold" style={{ color: "var(--ink)" }}>
          {label ?? `${Math.round(p)}%`}
        </span>
        {sub && (
          <span className="num mt-0.5 text-[0.6rem]" style={{ color: "var(--ink-faint)" }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
