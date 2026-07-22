import type { Reading } from "./types";

// Columnas exportadas (mismo orden que el esquema readings de Supabase).
const COLS: (keyof Reading)[] = [
  "ts", "temp_c", "fan_on", "fan_duty", "fan_rpm",
  "lat", "lng", "alt", "speed_kmph", "course", "sats", "hdop",
  "rssi", "uptime_s", "heap_free", "batt_soc", "power_w",
];

function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function readingsToCsv(rows: Reading[]): string {
  const head = COLS.join(",");
  const body = rows
    .map((r) => COLS.map((c) => cell(r[c])).join(","))
    .join("\n");
  return `${head}\n${body}\n`;
}

// Dispara la descarga en el navegador (client-only).
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
