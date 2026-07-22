import type { Reading, TempThresholds } from "./types";
import type { LinkState } from "./status";

// Severidad (espeja el enum `severity` del esquema).
export type Severity = "info" | "warning" | "serious" | "critical";
// Tipos de evento (espeja `event_kind`).
export type EventKind =
  | "over_temp"
  | "fast_heating"
  | "offline"
  | "gps_lost"
  | "geofence"
  | "tamper"
  | "low_battery"
  | "link_obstruction";

export interface Alert {
  id: string; // clave estable por tipo (para React y dedupe)
  kind: EventKind;
  severity: Severity;
  title: string;
  detail: string;
}

export const SEV_META: Record<
  Severity,
  { label: string; varName: string; glyph: string; rank: number }
> = {
  info: { label: "Info", varName: "--signal", glyph: "•", rank: 0 },
  warning: { label: "Advertencia", varName: "--warn", glyph: "⚠", rank: 1 },
  serious: { label: "Serio", varName: "--serious", glyph: "▲", rank: 2 },
  critical: { label: "Crítico", varName: "--crit", glyph: "⛔", rank: 3 },
};

export function sevColor(s: Severity): string {
  return `var(${SEV_META[s].varName})`;
}

// Deriva las alertas ACTIVAS del estado en vivo (enlace + última lectura +
// umbrales). Es la capa efímera; la bitácora persistente (tabla events) la
// alimenta n8n/firmware (I4 backend).
export function deriveAlerts(
  latest: Reading | null,
  link: LinkState,
  thr: TempThresholds
): Alert[] {
  const out: Alert[] = [];

  // Enlace / disponibilidad
  if (link === "offline") {
    out.push({
      id: "offline",
      kind: "offline",
      severity: "critical",
      title: "Unidad sin conexión",
      detail: "No llegan datos hace más de 1 min.",
    });
  } else if (link === "stale") {
    out.push({
      id: "stale",
      kind: "offline",
      severity: "warning",
      title: "Señal intermitente",
      detail: "Los datos llegan con retraso.",
    });
  }

  // Térmica (solo si hay dato y el enlace no está caído)
  const t = latest?.temp_c;
  if (link !== "offline" && t != null && !Number.isNaN(t)) {
    if (t >= thr.crit)
      out.push({ id: "temp", kind: "over_temp", severity: "critical", title: "Temperatura crítica", detail: `${t.toFixed(1)}°C ≥ ${thr.crit}°C (aire interior).` });
    else if (t >= thr.serious)
      out.push({ id: "temp", kind: "over_temp", severity: "serious", title: "Temperatura alta", detail: `${t.toFixed(1)}°C ≥ ${thr.serious}°C.` });
    else if (t >= thr.warn)
      out.push({ id: "temp", kind: "over_temp", severity: "warning", title: "Temperatura en aviso", detail: `${t.toFixed(1)}°C ≥ ${thr.warn}°C.` });
  }

  // GPS (sin fix confiable)
  if (link !== "offline" && (latest?.sats ?? 0) < 4) {
    out.push({
      id: "gps",
      kind: "gps_lost",
      severity: "warning",
      title: "Sin fix GPS",
      detail: `${latest?.sats ?? 0} satélites — sin posición confiable.`,
    });
  }

  // Batería (integración E — solo si hay dato)
  const soc = latest?.batt_soc;
  if (link !== "offline" && soc != null && soc <= 20) {
    out.push({
      id: "batt",
      kind: "low_battery",
      severity: soc <= 10 ? "serious" : "warning",
      title: "Batería baja",
      detail: `${soc}% de carga.`,
    });
  }

  return out.sort((a, b) => SEV_META[b.severity].rank - SEV_META[a.severity].rank);
}
