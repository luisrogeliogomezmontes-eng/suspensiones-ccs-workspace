// Formateo consistente para lecturas de tablero.

export function fmt(
  n: number | null | undefined,
  digits = 0,
  dash = "—"
): string {
  if (n == null || Number.isNaN(n)) return dash;
  return n.toLocaleString("es-VE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// "hace 3 s" / "hace 4 min" / "hace 2 h"
export function ago(ts: string | number | null | undefined, now = Date.now()): string {
  if (ts == null) return "—";
  const t = typeof ts === "number" ? ts : new Date(ts).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function hhmm(ts: string | number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
