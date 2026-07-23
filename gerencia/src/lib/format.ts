// Formateo (client-safe).

/** Horas decimales → "1h 10m" / "42m" / "0m". */
export function hm(h: number): string {
  const min = Math.max(Math.round(h * 60), 0);
  const H = Math.floor(min / 60);
  const m = min % 60;
  return H > 0 ? `${H}h ${m}m` : `${m}m`;
}

/** Horas con 2 decimales → "1.17 h". */
export function hDec(h: number): string {
  return `${h.toFixed(2)} h`;
}

/** "hace 3 d" / "hace 2 h" / "hace 15 min" / "hace instantes". */
export function relTime(iso: string | null, nowMs: number): string {
  if (!iso) return "—";
  const diff = nowMs - Date.parse(iso);
  if (diff < 0) return "programado";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

const FECHA = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function fechaHora(iso: string | null): string {
  if (!iso) return "—";
  return FECHA.format(new Date(iso));
}
