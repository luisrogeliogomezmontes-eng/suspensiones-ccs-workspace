"use client";

import { useEffect, useRef, useState } from "react";
import type { Device, Reading } from "./types";
import { getSupabase, DEFAULT_DEVICE_ID, FORCE_DEMO } from "./supabase/client";
import { MockSource } from "./mock";

export const WINDOW_MIN = 60; // ventana visible del Overview
const MOCK_STEP_MS = 2000;

export interface Telemetry {
  device: Device | null;
  readings: Reading[]; // cronológico ascendente, últimos WINDOW_MIN
  latest: Reading | null;
  source: "live" | "mock";
  connected: boolean; // canal realtime suscrito (solo live)
}

export const DEMO_DEVICE: Device = {
  id: DEFAULT_DEVICE_ID,
  name: "Centinela 01",
  fw_version: "p1-demo",
  temp_warn: 33,
  temp_serious: 40,
  temp_crit: 46,
  last_seen: null,
};

function trim(readings: Reading[], nowMs: number): Reading[] {
  const cutoff = nowMs - WINDOW_MIN * 60_000;
  return readings.filter((r) => new Date(r.ts).getTime() >= cutoff);
}

export function useTelemetry(deviceId = DEFAULT_DEVICE_ID): Telemetry {
  const [device, setDevice] = useState<Device | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [connected, setConnected] = useState(false);
  const supabase = FORCE_DEMO ? null : getSupabase();
  const source: "live" | "mock" = supabase ? "live" : "mock";

  const mockRef = useRef<MockSource | null>(null);

  useEffect(() => {
    let alive = true;

    // ── Modo MOCK (sin backend): demo autónoma ─────────────────────────────
    if (!supabase) {
      const mock = new MockSource(MOCK_STEP_MS);
      mockRef.current = mock;
      // Carga inicial desde una fuente externa (mock) — sincronización legítima.
      /* eslint-disable react-hooks/set-state-in-effect */
      setDevice(DEMO_DEVICE);
      setReadings(mock.history(WINDOW_MIN));
      /* eslint-enable react-hooks/set-state-in-effect */
      const id = setInterval(() => {
        if (!alive) return;
        const r = mock.next();
        setReadings((prev) => trim([...prev, r], Date.now()));
      }, MOCK_STEP_MS);
      return () => {
        alive = false;
        clearInterval(id);
      };
    }

    // ── Modo LIVE (Supabase) ───────────────────────────────────────────────
    (async () => {
      const { data: dev } = await supabase
        .from("devices")
        .select("*")
        .eq("id", deviceId)
        .maybeSingle();
      if (alive && dev) setDevice(dev as Device);

      const sinceIso = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
      const { data: rows } = await supabase
        .from("readings")
        .select("*")
        .eq("device_id", deviceId)
        .gte("ts", sinceIso)
        .order("ts", { ascending: true });
      if (alive && rows) setReadings(rows as Reading[]);
    })();

    const channel = supabase
      .channel(`readings:${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "readings",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          if (!alive) return;
          const r = payload.new as Reading;
          setReadings((prev) => trim([...prev, r], Date.now()));
        }
      )
      .subscribe((status) => {
        if (alive) setConnected(status === "SUBSCRIBED");
      });

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, deviceId]);

  return {
    device,
    readings,
    latest: readings.length ? readings[readings.length - 1] : null,
    source,
    connected,
  };
}

// Reloj compartido de 1 s — para "frescura"/ago aunque no lleguen datos.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
