"use client";

import { useEffect, useState } from "react";
import type { Device, Reading } from "./types";
import { getSupabase, DEFAULT_DEVICE_ID, FORCE_DEMO } from "./supabase/client";
import { MockSource } from "./mock";
import { DEMO_DEVICE } from "./useTelemetry";

// Rangos de tiempo del histórico (I2).
export const RANGES = [
  { key: "1h", label: "1 h", ms: 3_600_000 },
  { key: "6h", label: "6 h", ms: 6 * 3_600_000 },
  { key: "24h", label: "24 h", ms: 24 * 3_600_000 },
  { key: "7d", label: "7 d", ms: 7 * 24 * 3_600_000 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

// Tope de puntos a traer/renderizar. La telemetría va a ~5 s → 7 d serían >100k
// filas. Traemos las más recientes dentro del rango (orden desc + limit) y
// reducimos a ~MAX_POINTS por muestreo para que el SVG no se ahogue.
// ⚠️ Para 24 h/7 d completos con densidad uniforme hará falta agregación por
// buckets en el servidor (RPC/vista) — TODO fase posterior.
const FETCH_LIMIT = 4000;
const MAX_POINTS = 1500;

// Muestreo uniforme conservando primer y último punto.
function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const stride = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * stride)]);
  out[out.length - 1] = arr[arr.length - 1];
  return out;
}

export interface History {
  device: Device | null;
  readings: Reading[]; // cronológico ascendente, muestreado
  fetched: number; // filas realmente traídas (antes de muestrear)
  truncated: boolean; // ⚠️ el rango tenía más filas que FETCH_LIMIT
  source: "live" | "mock";
  loading: boolean;
  reload: () => void;
}

export function useHistory(
  rangeMs: number,
  deviceId = DEFAULT_DEVICE_ID
): History {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [fetched, setFetched] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const supabase = FORCE_DEMO ? null : getSupabase();
  const source: "live" | "mock" = supabase ? "live" : "mock";

  useEffect(() => {
    let alive = true;
    // Reset de estado al cambiar el rango: sincronización legítima con una
    // fuente externa (Supabase / mock), no un lazo de render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);

    // ── MOCK: genera un histórico sintético con densidad adaptada al rango.
    if (!supabase) {
      const minutes = Math.round(rangeMs / 60_000);
      const stepMs = Math.max(2000, Math.round(rangeMs / MAX_POINTS));
      const mock = new MockSource(stepMs);
      const rows = mock.history(minutes);
      setDevice(DEMO_DEVICE);
      setReadings(downsample(rows, MAX_POINTS));
      setFetched(rows.length);
      setTruncated(false);
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    // ── LIVE: snapshot de Supabase para el rango.
    (async () => {
      const { data: dev } = await supabase
        .from("devices")
        .select("*")
        .eq("id", deviceId)
        .maybeSingle();
      if (alive && dev) setDevice(dev as Device);

      const sinceIso = new Date(Date.now() - rangeMs).toISOString();
      const { data: rows } = await supabase
        .from("readings")
        .select("*")
        .eq("device_id", deviceId)
        .gte("ts", sinceIso)
        .order("ts", { ascending: false })
        .limit(FETCH_LIMIT);

      if (!alive) return;
      const asc = (rows ?? []).slice().reverse() as Reading[];
      setFetched(asc.length);
      setTruncated(asc.length >= FETCH_LIMIT);
      setReadings(downsample(asc, MAX_POINTS));
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [supabase, rangeMs, deviceId, nonce]);

  return {
    device,
    readings,
    fetched,
    truncated,
    source,
    loading,
    reload: () => setNonce((n) => n + 1),
  };
}
