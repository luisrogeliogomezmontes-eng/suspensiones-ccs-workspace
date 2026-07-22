"use client";

import { useEffect, useState } from "react";
import type { Reading } from "./types";
import { getSupabase, FORCE_DEMO } from "./supabase/client";
import { useDeviceList, type FleetDevice } from "./devices";
import { MockSource } from "./mock";

export interface FleetEntry {
  device: FleetDevice;
  latest: Reading | null;
}

// Última lectura de cada centinela de la flota, para la vista de conjunto.
// Snapshot inicial por unidad + realtime (readings SÍ está publicada) → las
// cards vivas se actualizan solas; las offline quedan con su último dato.
export function useFleet(): {
  entries: FleetEntry[];
  source: "live" | "mock";
  loading: boolean;
} {
  const { devices } = useDeviceList();
  const supabase = FORCE_DEMO ? null : getSupabase();
  const source: "live" | "mock" = supabase ? "live" : "mock";
  const [latestById, setLatestById] = useState<Record<string, Reading | null>>({});
  const [loading, setLoading] = useState(true);

  // Clave estable: solo re-suscribe si cambia el conjunto de unidades, no en
  // cada refresco de `last_seen` (que produce un array nuevo cada 30 s).
  const ids = devices.map((d) => d.id).join(",");

  useEffect(() => {
    let alive = true;
    const idList = ids ? ids.split(",") : [];

    // ── MOCK: una lectura sintética por unidad.
    if (!supabase) {
      const mock = new MockSource();
      const map: Record<string, Reading | null> = {};
      for (const id of idList) map[id] = mock.next();
      /* eslint-disable react-hooks/set-state-in-effect */
      setLatestById(map);
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return () => {
        alive = false;
      };
    }

    if (!idList.length) return () => { alive = false; };

    (async () => {
      const results = await Promise.all(
        idList.map((id) =>
          supabase
            .from("readings")
            .select("*")
            .eq("device_id", id)
            .order("ts", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => [id, (data as Reading) ?? null] as const)
        )
      );
      if (!alive) return;
      setLatestById(Object.fromEntries(results));
      setLoading(false);
    })();

    const ch = supabase
      .channel("fleet:readings")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings" },
        (payload) => {
          if (!alive) return;
          const r = payload.new as Reading & { device_id: string };
          setLatestById((prev) => ({ ...prev, [r.device_id]: r }));
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [supabase, ids]);

  const entries = devices.map((d) => ({
    device: d,
    latest: latestById[d.id] ?? null,
  }));
  return { entries, source, loading };
}
