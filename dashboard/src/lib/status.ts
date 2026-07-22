import type { Device, TempThresholds } from "./types";

// Umbrales por defecto (fallback demo / device sin fila). ⚠️ Son sobre la
// TEMPERATURA DEL AIRE interior de la maleta, no la superficie del equipo:
// el DHT22 mide el aire, que es el indicador adelantado de calor atrapado.
export const DEFAULT_TEMP_THRESHOLDS: TempThresholds = {
  warn: 33,
  serious: 40,
  crit: 46,
};

// Umbrales efectivos de un device (los suyos si existen, si no el default).
export function thresholdsOf(device: Device | null): TempThresholds {
  return device
    ? { warn: device.temp_warn, serious: device.temp_serious, crit: device.temp_crit }
    : DEFAULT_TEMP_THRESHOLDS;
}

// Estado reservado (dataviz): SIEMPRE acompañado de ícono + etiqueta, nunca solo color.
export type Level = "ok" | "warn" | "serious" | "crit" | "unknown";

export const LEVEL_META: Record<
  Level,
  { label: string; glyph: string; varName: string }
> = {
  ok: { label: "OK", glyph: "✓", varName: "--ok" },
  warn: { label: "Advertencia", glyph: "⚠", varName: "--warn" },
  serious: { label: "Serio", glyph: "▲", varName: "--serious" },
  crit: { label: "Crítico", glyph: "⛔", varName: "--crit" },
  unknown: { label: "Sin dato", glyph: "–", varName: "--ink-faint" },
};

export function levelColor(level: Level): string {
  return `var(${LEVEL_META[level].varName})`;
}

// Estado térmico según umbrales del dispositivo.
export function tempLevel(
  temp: number | null | undefined,
  thr: TempThresholds
): Level {
  if (temp == null || Number.isNaN(temp)) return "unknown";
  if (temp >= thr.crit) return "crit";
  if (temp >= thr.serious) return "serious";
  if (temp >= thr.warn) return "warn";
  return "ok";
}

// Rango de "frescura" del dato → online/stale/offline
export type LinkState = "online" | "stale" | "offline";

export function linkState(
  lastTs: string | null | undefined,
  now: number,
  staleMs = 15_000,
  offlineMs = 60_000
): LinkState {
  if (!lastTs) return "offline";
  const age = now - new Date(lastTs).getTime();
  if (age > offlineMs) return "offline";
  if (age > staleMs) return "stale";
  return "online";
}

// Estado de batería (integración E)
export function battLevel(soc: number | null | undefined): Level {
  if (soc == null) return "unknown";
  if (soc <= 10) return "crit";
  if (soc <= 20) return "serious";
  if (soc <= 35) return "warn";
  return "ok";
}
