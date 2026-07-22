// Sparkline minimalista (SVG). Trazo en tinta, no en color de serie (dataviz).
export function Sparkline({
  data,
  width = 96,
  height = 26,
  stroke = "var(--ink-dim)",
  fill = "transparent",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}) {
  const pts = data.filter((n) => Number.isFinite(n));
  if (pts.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * w;
    const y = pad + h - ((v - min) / span) * h;
    return [x, y] as const;
  });

  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area =
    fill !== "transparent"
      ? `M${coords[0][0].toFixed(1)},${(height - pad).toFixed(1)} ` +
        coords.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") +
        ` L${coords[coords.length - 1][0].toFixed(1)},${(height - pad).toFixed(1)} Z`
      : "";

  return (
    <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
      {area && <path d={area} fill={fill} opacity={0.14} />}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
